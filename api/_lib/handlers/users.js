import { getDb } from '../helpers/firebase.js';
import { verifyToken, setCors } from '../helpers/auth.js';

export async function search(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'No token' });

    const query = String(req.query.q || req.body?.q || '').trim().toLowerCase();
    if (query.length < 2) return res.status(400).json({ error: 'Query too short' });

    const db = getDb();
    const usernamesSnap = await db.ref('usernames').once('value');
    const usernames = usernamesSnap.val() || {};
    const results = [];

    for (const [username, uid] of Object.entries(usernames)) {
      if (username.toLowerCase().includes(query)) {
        const userSnap = await db.ref(`users/${uid}/profile`).once('value');
        const profile = userSnap.val() || {};
        results.push({
          uid,
          username,
          displayName: profile.displayName || profile.name || username,
          avatar: profile.avatar || '',
          name: profile.name || username
        });
        if (results.length >= 20) break;
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[users/search]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function sendTip(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const senderUid = decoded.uid;
    const { hostUid, roomId } = req.body || {};
    if (!hostUid) return res.status(400).json({ error: 'Missing hostUid' });
    if (senderUid === hostUid) return res.status(400).json({ error: 'Нельзя отправлять чаевые самому себе' });

    const TIP_AMOUNT = 50;
    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
    const db = getDb();

    if (!db) {
      return res.status(200).json({
        success: true,
        useClientFallback: true,
        tipAmount: TIP_AMOUNT
      });
    }

    const now = Date.now();
    const lastTipSnap = await db.ref(`users/${senderUid}/tipsSent/${hostUid}`).once('value');
    const lastTipTime = Number(lastTipSnap.val()) || 0;
    if (now - lastTipTime < COOLDOWN_MS) {
      const waitMs = COOLDOWN_MS - (now - lastTipTime);
      const hours = Math.floor(waitMs / (3600 * 1000));
      const mins = Math.ceil((waitMs % (3600 * 1000)) / (60 * 1000));
      const timeLeftStr = hours > 0 ? `${hours} ч. ${mins} мин.` : `${mins} мин.`;
      return res.status(429).json({
        error: `Вы уже отправляли чаевые этому автору. Следующая отправка доступна через ${timeLeftStr}.`
      });
    }

    const senderSnap = await db.ref(`users/${senderUid}/profile`).once('value');
    const senderProfile = senderSnap.val() || {};
    const senderLumens = Number(senderProfile.lumens) || 0;
    if (senderLumens < TIP_AMOUNT) {
      return res.status(400).json({
        error: `Недостаточно Люменов! Требуется ${TIP_AMOUNT}, у вас ${senderLumens}.`
      });
    }

    const hostSnap = await db.ref(`users/${hostUid}/profile`).once('value');
    const hostProfile = hostSnap.val() || {};
    const hostLumens = Number(hostProfile.lumens) || 0;
    const hostName = hostProfile.name || hostProfile.displayName || hostProfile.username || 'Хост';
    const senderName = senderProfile.name || senderProfile.displayName || senderProfile.username || 'Пользователь';

    const newSenderLumens = senderLumens - TIP_AMOUNT;
    const newHostLumens = hostLumens + TIP_AMOUNT;

    const updates = {
      [`users/${senderUid}/profile/lumens`]: newSenderLumens,
      [`users/${hostUid}/profile/lumens`]: newHostLumens,
      [`users/${senderUid}/tipsSent/${hostUid}`]: now,
    };

    await db.ref().update(updates);

    if (roomId) {
      try {
        await db.ref(`rooms/${roomId}/chat`).push({
          type: 'system',
          uid: 'system_tip',
          name: 'СИСТЕМА ЧАЕВЫХ',
          text: `🌟 ${senderName} отправил(а) 50 Люменов хосту ${hostName}!`,
          ts: now
        });
      } catch (chatErr) {
        console.warn('[users/sendTip] Chat notification warning:', chatErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      tipAmount: TIP_AMOUNT,
      newSenderLumens,
      hostName,
      senderName,
      sentAt: now
    });
  } catch (err) {
    console.error('[users/sendTip]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
