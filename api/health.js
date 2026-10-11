import { setCors } from './_lib/helpers/auth.js';
import { getSmtpConfig } from './_lib/handlers/custom-auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const smtp = getSmtpConfig();
  const allEnvKeys = Object.keys(process.env || {});
  const matchingSmtpKeys = allEnvKeys.filter((k) => /(smtp|smpt|mail|email|pass|user)/i.test(k));

  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    app: 'COWIO',
    env: process.env.NODE_ENV || 'production',
    smtp: {
      hasUser: Boolean(smtp.user),
      userKey: smtp.detectedUserKey,
      userMasked: smtp.user ? `${smtp.user.slice(0, 3)}***@${smtp.user.split('@')[1] || 'domain'}` : null,
      hasPass: Boolean(smtp.pass),
      passKey: smtp.detectedPassKey,
      passLength: smtp.pass ? smtp.pass.length : 0,
      host: smtp.host,
      port: smtp.parsedPort || 465,
      detectedKeysInEnv: matchingSmtpKeys
    }
  });
}
