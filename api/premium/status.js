export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MerchantId, X-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const uid = req.query.uid || '';
    const paymentId = req.query.paymentId || '';
    if (!uid) return res.status(400).json({ success: false, error: 'UID обязателен' });

    const PLATEGA_API_KEY = process.env.PLATEGA_API_KEY || '1lLu0Pb7yHD4DkPU8Pc7JBVN78h7pJCIh7dac1NFX1HCBpzNk6aD1mcC8yUeCHj0NTa2hesicgq3tM96r0iocsFaFtj0RhiKJsv2';
    const PLATEGA_MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID || 'f5c52bf0-56b2-485d-b5b1-b0f44cb34b8e';

    if (paymentId && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
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
            const now = Date.now();
            const amt = Number(txData.paymentDetails?.amount) || 179;
            const premiumData = {
              active: true,
              plan: 'premium_month',
              activatedAt: now,
              expiresAt: now + 30 * 24 * 60 * 60 * 1000,
              paymentId,
              amount: amt
            };
            return res.json({
              success: true,
              active: true,
              premium: premiumData,
              expiresAt: premiumData.expiresAt
            });
          } else if (txStatus === 'PENDING') {
            return res.json({
              success: true,
              active: false,
              pending: true,
              message: 'Платёж ожидает подтверждения банком'
            });
          } else if (txStatus === 'CANCELED' || txStatus === 'EXPIRED' || txStatus === 'FAILED') {
            return res.json({
              success: true,
              active: false,
              canceled: true,
              message: 'Платёж отменён или истёк срок действия'
            });
          }
        }
      } catch (chkErr) {
        console.warn('[Premium Status] Check Platega error:', chkErr);
      }
    }

    return res.json({
      success: true,
      active: false,
      premium: null,
      expiresAt: null
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Ошибка проверки статуса' });
  }
}
