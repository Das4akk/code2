export default async function handler(req, res) {
  try {
    const countryCode = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || req.headers['x-country-code'] || 'RU';
    const countryName = req.headers['x-vercel-ip-country-region'] || countryCode;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    
    return res.status(200).json({
      success: true,
      country: countryCode,
      countryName,
      ip
    });
  } catch (err) {
    return res.status(200).json({ success: true, country: 'RU', countryName: 'Россия' });
  }
}
