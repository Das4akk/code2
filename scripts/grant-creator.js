#!/usr/bin/env node
/**
 * COWIO Role Management CLI
 * Grants Creator/Admin privileges securely via Firebase Admin SDK.
 * 
 * Usage:
 *   node scripts/grant-creator.js <FIREBASE_UID>
 * 
 * Environment variables:
 *   FIREBASE_DATABASE_URL - Realtime DB URL
 *   FIREBASE_ADMIN_KEY   - Service account JSON string (or place serviceAccountKey.json in root)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetUid = process.argv[2]?.trim();

if (!targetUid) {
  console.error('\n❌ Ошибка: Не указан UID пользователя!');
  console.error('Использование: node scripts/grant-creator.js <firebase_uid>\n');
  process.exit(1);
}

// Initialize Firebase Admin
let initialized = false;
const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com';

try {
  if (process.env.FIREBASE_ADMIN_KEY) {
    const creds = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(creds),
      databaseURL
    });
    initialized = true;
  } else {
    const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const creds = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        databaseURL
      });
      initialized = true;
    }
  }
} catch (err) {
  console.error('❌ Ошибка инициализации Firebase Admin SDK:', err.message);
  process.exit(1);
}

if (!initialized) {
  console.error('❌ Ошибка: Отсутствуют учетные данные Firebase Admin SDK.');
  console.error('Укажите FIREBASE_ADMIN_KEY в .env или положите serviceAccountKey.json в корень проекта.');
  process.exit(1);
}

async function grantCreator(uid) {
  console.log(`[COWIO] Выдача прав Создателя для UID: ${uid}...`);
  const db = admin.database();

  try {
    // Verify user exists in Firebase Auth
    let userRecord = null;
    try {
      userRecord = await admin.auth().getUser(uid);
      console.log(`[COWIO] Пользователь найден в Auth: ${userRecord.email || userRecord.displayName || uid}`);
    } catch (e) {
      console.warn(`[COWIO] Предупреждение: UID ${uid} не найден в Auth API, продолжаем запись в RTDB...`);
    }

    const now = Date.now();
    const adminRecord = {
      role: 'creator',
      isOwner: true,
      grantedAt: now,
      email: userRecord?.email || null,
      grantedBy: 'cli_admin_script'
    };

    // Update /admins/{uid}
    await db.ref(`admins/${uid}`).set(adminRecord);
    console.log(`✅ Успешно записано в /admins/${uid}`);

    // Update /users/{uid}/profile/role
    await db.ref(`users/${uid}/profile/role`).set('creator');
    console.log(`✅ Обновлена роль профиля в /users/${uid}/profile/role -> creator`);

    console.log(`\n🎉 Готово! Пользователь ${uid} теперь имеет статус Создателя в COWIO.\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка при выдаче прав:', err.message);
    process.exit(1);
  }
}

grantCreator(targetUid);
