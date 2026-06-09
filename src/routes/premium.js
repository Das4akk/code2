import crypto from "crypto";

const PREMIUM_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const pendingPayments = new Map();

function yukassaConfigured() {
  return Boolean(
    process.env.YUKASSA_SHOP_ID &&
      process.env.YUKASSA_SECRET_KEY &&
      process.env.YUKASSA_SHOP_ID !== "your_shop_id",
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

async function createYukassaPayment({ uid, email, returnUrl, amount }) {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secret = process.env.YUKASSA_SECRET_KEY;
  const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
  const idempotenceKey = crypto.randomUUID();

  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amount, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: "COWIO Premium — 1 месяц",
      metadata: { uid, plan: "monthly", product: "cowio_premium" },
      receipt: email
        ? {
            customer: { email },
            items: [
              {
                description: "COWIO Premium подписка 30 дней",
                quantity: "1.00",
                amount: { value: amount, currency: "RUB" },
                vat_code: 1,
                payment_mode: "full_payment",
                payment_subject: "service",
              },
            ],
          }
        : undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.description || data?.message || "YooKassa error");
  }
  return data;
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

      const amount = Number(process.env.PREMIUM_PRICE_RUB || 179).toFixed(2);
      const baseUrl = getBaseUrl(req);
      const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;

      if (!yukassaConfigured()) {
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
          error: "Платежи не настроены. Добавьте YUKASSA_SHOP_ID и YUKASSA_SECRET_KEY в .env",
          setupRequired: true,
        });
      }

      const payment = await createYukassaPayment({
        uid,
        email: verified.email || email,
        returnUrl,
        amount,
      });

      pendingPayments.set(payment.id, {
        uid,
        status: payment.status,
        createdAt: Date.now(),
      });

      const db = getFirebaseDb(admin);
      if (db) {
        await db.ref(`premium_orders/${payment.id}`).set({
          uid,
          status: payment.status,
          amountRub: Number(amount),
          createdAt: Date.now(),
        });
      }

      res.json({
        success: true,
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        status: payment.status,
      });
    } catch (e) {
      console.error("[Premium] create-payment:", e);
      res.status(500).json({ success: false, error: e.message || "Ошибка создания платежа" });
    }
  });

  app.post("/api/premium/webhook", async (req, res) => {
    try {
      const event = req.body?.event;
      const payment = req.body?.object;
      if (!payment?.id) return res.status(400).send("bad request");

      if (event === "payment.succeeded" && payment.status === "succeeded") {
        const uid = payment.metadata?.uid;
        if (uid) {
          const amount = payment.amount?.value || process.env.PREMIUM_PRICE_RUB || 179;
          await activatePremium(admin, uid, payment.id, amount);
        }
      }

      if (event === "payment.canceled") {
        const db = getFirebaseDb(admin);
        if (db) {
          await db.ref(`premium_orders/${payment.id}/status`).set("canceled");
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
        const active = Boolean(premium?.active && Number(premium.expiresAt) > Date.now());

        if (paymentId && yukassaConfigured()) {
          const shopId = process.env.YUKASSA_SHOP_ID;
          const secret = process.env.YUKASSA_SECRET_KEY;
          const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
          const payRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          if (payRes.ok) {
            const payData = await payRes.json();
            if (payData.status === "succeeded" && payData.metadata?.uid === uid && !active) {
              await activatePremium(admin, uid, paymentId, payData.amount?.value);
              const refreshed = await readExistingPremium(db, uid);
              return res.json({ success: true, active: true, premium: refreshed });
            }
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
}
