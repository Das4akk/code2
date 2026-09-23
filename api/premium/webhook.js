export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MerchantId, X-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch {}
    }
    console.log('[Platega Webhook] Received:', JSON.stringify(payload));
    res.json({ success: true, message: 'Webhook received' });
  } catch (e) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
