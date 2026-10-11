import { setCors } from './_lib/helpers/auth.js';
import { initEnv } from './_lib/helpers/env.js';
import { getDiagnostics } from './_lib/handlers/custom-auth.js';

initEnv();

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return await getDiagnostics(req, res);
}
