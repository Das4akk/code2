import { setCors } from './_lib/helpers/auth.js';
import { handleEmojiRequest } from './emoji-service.js';

export default async function handler(req, res) {
  setCors(req, res);
  return handleEmojiRequest(req, res);
}

