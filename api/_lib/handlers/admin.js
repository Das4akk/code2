import { getDb } from '../helpers/firebase.js';
import { requireAdmin, requireCreator } from '../helpers/auth.js';

export async function recalcLeaderboard(req, res) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

    const db = getDb();
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const leaderboard = [];

    for (const [uid, data] of Object.entries(users)) {
      const profile = data.profile || {};
      const name = (profile.name || data.name || profile.displayName || data.displayName || profile.username || data.username || (data.email ? data.email.split('@')[0] : '') || 'Пользователь').trim();
      const username = (profile.username || data.username || (data.email ? data.email.split('@')[0] : '') || 'user').trim();
      const avatar = profile.avatar || data.avatar || profile.photoURL || data.photoURL || '';
      const frame = profile.frame || data.equippedFrame || '';
      const lumens = Number(profile.lumens != null ? profile.lumens : (data.lumens != null ? data.lumens : 0)) || 0;
      const xp = Number(profile.xp != null ? profile.xp : (data.xp != null ? data.xp : 0)) || 0;
      const level = Number(profile.level != null ? profile.level : (data.level != null ? data.level : 1)) || 1;
      const timeSpentInRooms = Number(profile.timeSpentInRooms != null ? profile.timeSpentInRooms : (data.timeSpentInRooms != null ? data.timeSpentInRooms : 0)) || 0;
      const streak = Number(profile.streak != null ? profile.streak : (data.streak != null ? data.streak : 0)) || 0;
      const likedBy = profile.likedBy || data.likedBy || {};
      const likesCount = Object.keys(likedBy).length;

      leaderboard.push({
        uid,
        name,
        username,
        avatar,
        frame,
        xp,
        level,
        lumens,
        streak,
        likes: likesCount,
        timeSpentInRooms,
        likedBy
      });
    }

    leaderboard.sort((a, b) => (b.lumens || 0) - (a.lumens || 0));
    const top100 = leaderboard.slice(0, 100);

    await db.ref('leaderboard').set({
      updatedAt: Date.now(),
      users: top100,
    });

    return res.status(200).json({ success: true, count: top100.length });
  } catch (err) {
    console.error('[admin/recalc-leaderboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function setUserRole(req, res, decoded) {
  try {
    const user = decoded || (await requireCreator(req));
    if (!user) {
      return res.status(403).json({ error: 'Forbidden: creator only' });
    }

    const { targetUid, newRole } = req.body || {};
    if (!targetUid) {
      return res.status(400).json({ error: 'Missing targetUid' });
    }

    const db = getDb();
    const requesterSnap = await db.ref(`admins/${user.uid}`).once('value');
    const requester = requesterSnap.val();

    // Только creator может менять роли
    if (!requester || requester.role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden: creator only' });
    }

    // Защита: нельзя понизить другого creator
    const targetSnap = await db.ref(`admins/${targetUid}`).once('value');
    const target = targetSnap.val();
    if (target?.role === 'creator' && newRole && newRole !== 'creator') {
      return res.status(400).json({ error: 'Cannot downgrade creator' });
    }

    if (newRole) {
      await db.ref(`admins/${targetUid}`).update({
        role: newRole,
        isOwner: newRole === 'creator',
        isDeveloper: newRole === 'creator',
        updatedAt: Date.now(),
        updatedBy: user.uid
      });
      await db.ref(`users/${targetUid}/profile/role`).set(newRole);
      await db.ref(`users/${targetUid}/role`).set(newRole);
    } else {
      await db.ref(`admins/${targetUid}`).remove();
      await db.ref(`users/${targetUid}/profile/role`).remove();
      await db.ref(`users/${targetUid}/role`).remove();
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[set-user-role]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function updateUserField(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

    const { targetUid, path, value } = req.body || {};
    if (!targetUid || !path) return res.status(400).json({ error: 'Missing params' });

    const allowedPaths = [
      'premium',
      'lumens',
      'profile/xp',
      'profile/streak',
      'profile/level',
      'profile/lumens',
      'profile/premium',
      'role',
      'profile/role',
      'dailyGiftLumens',
    ];
    if (!allowedPaths.includes(path)) return res.status(400).json({ error: 'Path not allowed' });

    const db = getDb();
    await db.ref(`users/${targetUid}/${path}`).set(value);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin/update-user-field]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function setMaintenance(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const creatorUser = await requireCreator(req);
    if (!creatorUser) return res.status(403).json({ error: 'Forbidden: creator only' });

    const { type, global, reason, sectionKey, active } = req.body || {};
    const db = getDb();

    if (db) {
      if (type === 'global' || global !== undefined) {
        await db.ref('system/maintenance').update({
          global: Boolean(global),
          reason: reason || '',
          updatedAt: Date.now()
        });
        return res.status(200).json({ success: true, global: Boolean(global) });
      }

      if (type === 'section' || sectionKey) {
        if (!sectionKey) return res.status(400).json({ error: 'Missing sectionKey' });
        await db.ref('system/maintenance/sections').update({
          [sectionKey]: Boolean(active)
        });
        return res.status(200).json({ success: true, sectionKey, active: Boolean(active) });
      }
    } else {
      // REST API fallback using user's token or database URL
      const dbUrl = process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com';
      const authParam = creatorUser.idToken ? `?auth=${encodeURIComponent(creatorUser.idToken)}` : '';
      if (type === 'global' || global !== undefined) {
        const patchRes = await fetch(`${dbUrl}/system/maintenance.json${authParam}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            global: Boolean(global),
            reason: reason || '',
            updatedAt: Date.now()
          })
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok || patchData.error) {
          throw new Error(patchData.error || `HTTP ${patchRes.status}`);
        }
        return res.status(200).json({ success: true, global: Boolean(global) });
      }

      if (type === 'section' || sectionKey) {
        if (!sectionKey) return res.status(400).json({ error: 'Missing sectionKey' });
        const patchRes = await fetch(`${dbUrl}/system/maintenance/sections.json${authParam}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [sectionKey]: Boolean(active)
          })
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok || patchData.error) {
          throw new Error(patchData.error || `HTTP ${patchRes.status}`);
        }
        return res.status(200).json({ success: true, sectionKey, active: Boolean(active) });
      }
    }

    return res.status(400).json({ error: 'Invalid maintenance payload' });
  } catch (err) {
    console.error('[admin/set-maintenance]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

