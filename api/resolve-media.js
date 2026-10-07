import { setCors } from './_lib/helpers/auth.js';
import * as videoHandler from './_lib/handlers/video.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return await videoHandler.resolveMedia(req, res);
}
