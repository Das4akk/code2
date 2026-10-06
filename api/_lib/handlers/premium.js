import crypto from 'crypto';
import { getDb } from '../helpers/firebase.js';
import { verifyToken, setCors } from '../helpers/auth.js';

const PLATEGA_API_KEY = (process.env.PLATEGA_API_KEY || '').trim();
const PLATEGA_MERCHANT_ID = (process.env.PLATEGA_MERCHANT_ID || '').trim();
const PLATEGA_WEBHOOK_SECRET = (process.env.PLATEGA_WEBHOOK_SECRET || '').trim();

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'cowio.ru';
  return `${proto}://${host}`;
}

async function activatePremium(uid, paymentId, amount) {
  const db = getDb();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  const premiumData = {
    active: true,
    plan: 'premium_month',
    activatedAt: now,
    expiresAt,
    paymentId: paymentId || null,
    amount: Number(amount) || 179
  };

  try {
    await db.ref(`users/${uid}/profile/premium`).set(premiumData);
  } catch (e) {
    console.warn('[Premium] Firebase DB set warning:', e.message);
  }
  return premiumData;
}

export async function createPayment(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const uid = decoded.uid;
    const { userName, email } = req.body || {};

    const amount = Number(process.env.PREMIUM_PRICE_RUB || 179);
    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;
    const failedUrl = `${baseUrl}/?premium_return=failed&uid=${encodeURIComponent(uid)}`;
    const orderId = `cowio_prem_${uid}_${Date.now()}`;
    const clientIp =
      (req.headers['x-forwarded-for'])?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    if (!PLATEGA_API_KEY || !PLATEGA_MERCHANT_ID) {
      return res.status(503).json({ success: false, error: 'Шлюз Platega не настроен на сервере' });
    }

    const plategaHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Secret': PLATEGA_API_KEY,
      'X-MerchantId': PLATEGA_MERCHANT_ID
    };

    const plategaPayload = {
      paymentMethod: 2,
      paymentDetails: {
        amount: amount,
        currency: 'RUB'
      },
      description: 'Подписка COWIO Premium (30 дней)',
      return: returnUrl,
      failedUrl: failedUrl,
      payload: JSON.stringify({ uid, orderId }),
      metadata: {
        userId: String(uid),
        userName: String(userName || email || decoded.email || 'User'),
        clientIp: clientIp
      }
    };

    const plategaRes = await fetch('https://app.platega.io/transaction/process', {
      method: 'POST',
      headers: plategaHeaders,
      body: JSON.stringify(plategaPayload)
    });

    if (!plategaRes.ok) {
      const errText = await plategaRes.text();
      let errMsg = 'Ошибка платежного шлюза Platega';
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errMsg = `Platega: ${parsed.message}`;
      } catch {}
      return res.status(plategaRes.status || 400).json({ success: false, error: errMsg });
    }

    const pData = await plategaRes.json();
    const confirmationUrl = pData.redirect || pData.url || pData.confirmationUrl;
    if (!confirmationUrl) {
      return res.status(502).json({ success: false, error: 'Шлюз не предоставил ссылку для оплаты' });
    }

    return res.status(200).json({
      success: true,
      confirmationUrl,
      paymentId: pData.transactionId || pData.id || orderId,
      returnUrl
    });
  } catch (e) {
    console.error('[Premium] create-payment error:', e.message);
    return res.status(500).json({ success: false, error: 'Ошибка создания платежа' });
  }
}

export async function status(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const uid = decoded.uid;
    const paymentId = (req.query.paymentId || req.body?.paymentId) || '';

    const db = getDb();
    let currentPremium = null;
    const premiumSnap = await db.ref(`users/${uid}/profile/premium`).once('value');
    if (premiumSnap.exists()) currentPremium = premiumSnap.val();

    let isActive = Boolean(currentPremium?.active && Number(currentPremium.expiresAt) > Date.now());

    if (!isActive && paymentId && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
      try {
        const pRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(paymentId)}`, {
          headers: {
            'X-MerchantId': PLATEGA_MERCHANT_ID,
            'X-Secret': PLATEGA_API_KEY
          }
        });
        if (pRes.ok) {
          const txData = await pRes.json();
          const txStatus = String(txData.status || '').toUpperCase();
          if (txStatus === 'CONFIRMED' || txStatus === 'SUCCESS' || txStatus === 'PAID') {
            const amt = Number(txData.paymentDetails?.amount) || 179;
            currentPremium = await activatePremium(uid, paymentId, amt);
            isActive = true;
          }
        }
      } catch (chkErr) {
        console.warn('[Premium Status] Check Platega tx error:', chkErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      active: isActive,
      premium: isActive ? currentPremium : null,
      expiresAt: currentPremium?.expiresAt || null
    });
  } catch (e) {
    console.error('[Premium Status] error:', e.message);
    return res.status(500).json({ success: false, error: 'Ошибка проверки статуса' });
  }
}

export async function webhook(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const payload = req.body || {};
    const signature = (req.headers['x-signature'] || req.headers['x-platega-signature'] || '');
    const txId = payload.id || payload.transactionId || '';

    if (!txId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    let verified = false;

    if (signature && PLATEGA_WEBHOOK_SECRET) {
      const computedSig = crypto
        .createHmac('sha256', PLATEGA_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
      try {
        verified = crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(computedSig, 'utf8'));
      } catch {
        verified = false;
      }
    }

    if (!verified && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
      try {
        const verifyRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(txId)}`, {
          headers: {
            'X-MerchantId': PLATEGA_MERCHANT_ID,
            'X-Secret': PLATEGA_API_KEY
          }
        });
        if (verifyRes.ok) {
          const apiData = await verifyRes.json();
          const apiStatus = String(apiData.status || '').toUpperCase();
          if (apiStatus === 'CONFIRMED' || apiStatus === 'SUCCESS' || apiStatus === 'PAID') {
            verified = true;
          }
        }
      } catch (err) {}
    }

    if (!verified) {
      return res.status(403).json({ success: false, error: 'Untrusted webhook signature' });
    }

    const db = getDb();
    const logSnap = await db.ref(`payments_log/${txId}`).once('value');
    if (logSnap.exists()) {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    let targetUid = payload.uid || payload.userId || '';
    let orderId = payload.orderId || payload.externalId || txId;
    const amount = Number(payload.paymentDetails?.amount) || Number(payload.amount) || 179;

    if (!targetUid && payload.payload) {
      try {
        const parsed = typeof payload.payload === 'string' ? JSON.parse(payload.payload) : payload.payload;
        if (parsed.uid) targetUid = parsed.uid;
        if (parsed.orderId) orderId = parsed.orderId;
      } catch {}
    }

    if (!targetUid && orderId && orderId.startsWith('cowio_prem_')) {
      const parts = orderId.split('_');
      targetUid = parts[2];
    }

    if (targetUid) {
      await activatePremium(targetUid, txId || orderId, amount);
      await db.ref(`payments_log/${txId}`).set({
        uid: targetUid,
        orderId,
        amount,
        processedAt: Date.now(),
        status: 'CONFIRMED'
      });
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    console.error('[Premium Webhook] Error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
