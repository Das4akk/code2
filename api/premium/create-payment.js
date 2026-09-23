export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MerchantId, X-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const { uid, userName, email, priceRub, planDays } = body || {};
    if (!uid) return res.status(400).json({ success: false, error: 'UID обязателен' });

    const PLATEGA_API_KEY = process.env.PLATEGA_API_KEY || '1lLu0Pb7yHD4DkPU8Pc7JBVN78h7pJCIh7dac1NFX1HCBpzNk6aD1mcC8yUeCHj0NTa2hesicgq3tM96r0iocsFaFtj0RhiKJsv2';
    const PLATEGA_MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID || 'f5c52bf0-56b2-485d-b5b1-b0f44cb34b8e';
    const amount = Number(priceRub || process.env.PREMIUM_PRICE_RUB || 179);
    const days = Number(planDays || 30);

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'cowio.vercel.app';
    const baseUrl = `${proto}://${host}`;

    const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}&days=${days}`;
    const failedUrl = `${baseUrl}/?premium_return=failed&uid=${encodeURIComponent(uid)}`;
    const orderId = `cowio_prem_${uid}_${Date.now()}`;
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';

    const plategaHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Secret': PLATEGA_API_KEY,
      'X-MerchantId': PLATEGA_MERCHANT_ID
    };

    const plategaPayload = {
      paymentMethod: 2,
      paymentDetails: {
        amount: amount,
        currency: 'RUB'
      },
      description: `Подписка COWIO Premium (${days} дней)`,
      return: returnUrl,
      failedUrl: failedUrl,
      payload: JSON.stringify({ uid, orderId, days }),
      metadata: {
        userId: String(uid),
        userName: String(userName || email || 'User'),
        clientIp: clientIp,
        planDays: String(days)
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
    return res.status(500).json({ success: false, error: e.message || 'Ошибка создания платежа' });
  }
}
