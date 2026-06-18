import crypto from "crypto";

const PREMIUM_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const LAVA_API_BASE = "https://gate.lava.top";

function lavaConfigured() {
  return Boolean(
    process.env.LAVA_API_KEY &&
      process.env.LAVA_OFFER_ID &&
      process.env.LAVA_API_KEY !== "your_lava_api_key",
  );
}

function getBaseUrl(req) {
  const fromEnv = process.env.APP_BASE_URL;
  const fromVercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const fromReq = `${req.protocol}://${req.get("host")}`;
  return (fromEnv || fromVercel || fromReq).replace(/\/$/, "");
}

function getFirebaseDb(admin) {
  if (!admin?.apps?.length) return null;
  try {
    return admin.database();
  } catch {
    return null;
  }
}

async function readExistingPremium(db, uid) {
  if (!db) return null;
  const snap = await db.ref(`users/${uid}/profile/premium`).once("value");
  return snap.exists() ? snap.val() : null;
}

async function activatePremium(admin, uid, paymentId, amountRub) {
  const db = getFirebaseDb(admin);
  const now = Date.now();
  let expiresAt = now + PREMIUM_DAYS_MS;

  const existing = db ? await readExistingPremium(db, uid) : null;
  if (existing?.expiresAt && Number(existing.expiresAt) > now) {
    expiresAt = Number(existing.expiresAt) + PREMIUM_DAYS_MS;
  }

  const premium = {
    active: true,
    expiresAt,
    since: existing?.since || now,
    plan: "monthly",
    statusEmoji: existing?.statusEmoji || "star",
    lastPaymentId: paymentId || null,
    lastAmountRub: amountRub || Number(process.env.PREMIUM_PRICE_RUB || 179),
    updatedAt: now,
  };

  if (db) {
    await db.ref(`users/${uid}/profile/premium`).set(premium);
    
    // Auto-boost to level 10 (24000 XP) if below
    try {
      const xpSnap = await db.ref(`users/${uid}/profile/xp`).once("value");
      const currentXp = Number(xpSnap.val()) || 0;
      const level10Xp = 24000;
      if (currentXp < level10Xp) {
        await db.ref(`users/${uid}/profile/xp`).set(level10Xp);
      }
    } catch (e) {
      console.error("[Premium] Failed to boost xp", e);
    }

    await db.ref(`premium_orders/${paymentId || `manual_${uid}_${now}`}`).set({
      uid,
      status: "succeeded",
      amountRub: premium.lastAmountRub,
      createdAt: now,
      expiresAt,
    });
  }

  return premium;
}

async function revokePremium(admin, uid) {
  const db = getFirebaseDb(admin);
  const now = Date.now();
  if (db) {
    await db.ref(`users/${uid}/profile/premium`).set({
      active: false,
      expiresAt: now,
      updatedAt: now,
    });
  }
  return { active: false, expiresAt: now };
}

async function verifyUidEmail(admin, uid, email) {
  if (!admin?.apps?.length) return { ok: true, reason: "no_admin" };
  try {
    const user = await admin.auth().getUser(uid);
    if (!user) return { ok: false, reason: "user_not_found" };
    const authEmail = (user.email || "").toLowerCase();
    const reqEmail = (email || "").toLowerCase();
    if (authEmail && reqEmail && authEmail !== reqEmail) {
      return { ok: false, reason: "email_mismatch" };
    }
    return { ok: true, email: authEmail || reqEmail };
  } catch {
    return { ok: false, reason: "auth_error" };
  }
}

async function lavaRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${LAVA_API_BASE}${path}`, {
    method,
    headers: {
      "X-Api-Key": process.env.LAVA_API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || data?.detail || `LAVA HTTP ${response.status}`,
    );
  }
  return data;
}

async function createLavaInvoice({ uid, email, returnUrl }) {
  const offerId = process.env.LAVA_OFFER_ID;
  const body = {
    email,
    offerId,
    currency: "RUB",
    buyerLanguage: "RU",
    clientUtm: {
      utm_source: "cowio",
      utm_medium: "premium",
      utm_campaign: "monthly",
      utm_content: uid,
    },
  };

  if (returnUrl) {
    body.successUrl = returnUrl;
    body.failUrl = returnUrl;
  }

  const data = await lavaRequest("/v2/invoice", { method: "POST", body });
  const paymentId =
    data.id || data.invoiceId || data.contractId || data.paymentId || null;
  const confirmationUrl =
    data.paymentUrl || data.url || data.payUrl || data.confirmationUrl || null;

  if (!paymentId || !confirmationUrl) {
    throw new Error("LAVA: не получена ссылка на оплату");
  }

  return { paymentId, confirmationUrl, raw: data };
}

async function getLavaInvoiceStatus(paymentId) {
  try {
    return await lavaRequest(`/api/v2/invoices/${paymentId}`);
  } catch {
    return await lavaRequest(`/v1/invoices/${paymentId}`);
  }
}

function isLavaPaymentSuccess(invoice) {
  const status = String(invoice?.status || invoice?.contractStatus || "").toUpperCase();
  return (
    status === "COMPLETED" ||
    status === "SUCCESS" ||
    status === "PAID" ||
    status === "SUCCEEDED" ||
    invoice?.success === true
  );
}

function extractUidFromWebhook(payload) {
  const direct =
    payload?.metadata?.uid ||
    payload?.customFields?.uid ||
    payload?.clientUtm?.utm_content ||
    payload?.utm?.utm_content;
  if (direct) return String(direct);

  const nested =
    payload?.data?.metadata?.uid ||
    payload?.data?.clientUtm?.utm_content ||
    payload?.contract?.clientUtm?.utm_content;
  return nested ? String(nested) : null;
}

function extractInvoiceIdFromWebhook(payload) {
  return (
    payload?.invoiceId ||
    payload?.id ||
    payload?.contractId ||
    payload?.data?.invoiceId ||
    payload?.data?.id ||
    payload?.data?.contractId ||
    null
  );
}

function isLavaSuccessEvent(payload) {
  const eventType = String(
    payload?.eventType || payload?.type || payload?.event || "",
  ).toLowerCase();
  return (
    eventType.includes("payment.success") ||
    eventType.includes("subscription.recurring.payment.success") ||
    payload?.status === "success" ||
    payload?.contractStatus === "success"
  );
}

export function registerPremiumRoutes(app, admin) {
  app.post("/api/premium/create-payment", async (req, res) => {
    try {
      const { uid, email } = req.body || {};
      if (!uid) return res.status(400).json({ success: false, error: "UID обязателен" });

      const verified = await verifyUidEmail(admin, uid, email);
      if (!verified.ok && verified.reason !== "no_admin") {
        return res.status(403).json({ success: false, error: "Не удалось проверить аккаунт" });
      }

      const amount = Number(process.env.PREMIUM_PRICE_RUB || 179);
      const baseUrl = getBaseUrl(req);
      const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;

      if (!lavaConfigured()) {
        if (process.env.PREMIUM_SANDBOX_AUTO === "true") {
          const premium = await activatePremium(admin, uid, `sandbox_${Date.now()}`, amount);
          return res.json({
            success: true,
            sandbox: true,
            activated: true,
            premium,
            message: "Sandbox: Premium активирован без оплаты (PREMIUM_SANDBOX_AUTO=true)",
          });
        }
        return res.status(503).json({
          success: false,
          error: "Платежи не настроены. Добавьте LAVA_API_KEY и LAVA_OFFER_ID в .env",
          setupRequired: true,
        });
      }

      const payment = await createLavaInvoice({
        uid,
        email: verified.email || email,
        returnUrl,
      });

      const db = getFirebaseDb(admin);
      if (db) {
        await db.ref(`premium_orders/${payment.paymentId}`).set({
          uid,
          status: "pending",
          amountRub: amount,
          provider: "lava",
          createdAt: Date.now(),
        });
      }

      res.json({
        success: true,
        paymentId: payment.paymentId,
        confirmationUrl: payment.confirmationUrl,
        status: "pending",
      });
    } catch (e) {
      console.error("[Premium] create-payment:", e);
      res.status(500).json({ success: false, error: e.message || "Ошибка создания платежа" });
    }
  });

  app.post("/api/premium/webhook", async (req, res) => {
    try {
      const webhookKey = process.env.LAVA_WEBHOOK_KEY;
      if (webhookKey) {
        const incoming = req.headers["x-api-key"] || req.headers["x-webhook-key"];
        if (incoming !== webhookKey) {
          return res.status(401).send("unauthorized");
        }
      }

      const payload = req.body || {};
      if (!isLavaSuccessEvent(payload)) {
        return res.status(200).send("ok");
      }

      const paymentId = extractInvoiceIdFromWebhook(payload);
      let uid = extractUidFromWebhook(payload);
      const db = getFirebaseDb(admin);

      if (!uid && paymentId && db) {
        const orderSnap = await db.ref(`premium_orders/${paymentId}/uid`).once("value");
        if (orderSnap.exists()) uid = orderSnap.val();
      }

      if (uid) {
        const amount =
          payload?.amount ||
          payload?.data?.amount ||
          process.env.PREMIUM_PRICE_RUB ||
          179;
        await activatePremium(admin, uid, paymentId || `lava_${Date.now()}`, amount);
        if (db && paymentId) {
          await db.ref(`premium_orders/${paymentId}/status`).set("succeeded");
        }
      }

      res.status(200).send("ok");
    } catch (e) {
      console.error("[Premium] webhook:", e);
      res.status(500).send("error");
    }
  });

  app.get("/api/premium/status", async (req, res) => {
    try {
      const { uid, paymentId } = req.query;
      if (!uid) return res.status(400).json({ success: false, error: "UID обязателен" });

      const db = getFirebaseDb(admin);
      if (db) {
        const premiumSnap = await db.ref(`users/${uid}/profile/premium`).once("value");
        const premium = premiumSnap.exists() ? premiumSnap.val() : null;
        let active = Boolean(premium?.active && Number(premium.expiresAt) > Date.now());

        if (paymentId && lavaConfigured() && !active) {
          try {
            const payData = await getLavaInvoiceStatus(paymentId);
            const orderUidSnap = await db.ref(`premium_orders/${paymentId}/uid`).once("value");
            const orderUid = orderUidSnap.exists() ? orderUidSnap.val() : null;
            if (isLavaPaymentSuccess(payData) && (orderUid === uid || !orderUid)) {
              await activatePremium(
                admin,
                uid,
                paymentId,
                payData.amount || process.env.PREMIUM_PRICE_RUB || 179,
              );
              const refreshed = await readExistingPremium(db, uid);
              active = Boolean(refreshed?.active && Number(refreshed.expiresAt) > Date.now());
              return res.json({ success: true, active, premium: active ? refreshed : null });
            }
          } catch (pollErr) {
            console.warn("[Premium] status poll:", pollErr.message);
          }
        }

        return res.json({
          success: true,
          active,
          premium: active ? premium : null,
          expiresAt: premium?.expiresAt || null,
        });
      }

      res.json({ success: true, active: false, premium: null });
    } catch (e) {
      console.error("[Premium] status:", e);
      res.status(500).json({ success: false, error: "Ошибка статуса" });
    }
  });

  app.post("/api/premium/grant", async (req, res) => {
    try {
      const secret = req.headers["x-premium-admin-secret"];
      if (!secret || secret !== process.env.PREMIUM_ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      const { uid } = req.body || {};
      if (!uid) return res.status(400).json({ success: false, error: "UID обязателен" });
      const premium = await activatePremium(admin, uid, `admin_grant_${Date.now()}`, 0);
      res.json({ success: true, premium });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/premium/revoke", async (req, res) => {
    try {
      const secret = req.headers["x-premium-admin-secret"];
      if (!secret || secret !== process.env.PREMIUM_ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      const { uid } = req.body || {};
      if (!uid) return res.status(400).json({ success: false, error: "UID обязателен" });
      const premium = await revokePremium(admin, uid);
      res.json({ success: true, premium });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
