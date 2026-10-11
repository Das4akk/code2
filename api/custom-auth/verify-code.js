import { setCors } from '../_lib/helpers/auth.js';
import * as customAuthHandler from '../_lib/handlers/custom-auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return await customAuthHandler.verifyCode(req, res);
}
