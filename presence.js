import { db, ref, set, onValue, onDisconnect } from './firebase.js';

export function initPresence(userId) {
  const statusRef = ref(db, `status/${userId}`);
  const connectedRef = ref(db, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (!snap.val()) return;

    onDisconnect(statusRef).set({
      online: false,
      lastSeen: Date.now()
    });

    set(statusRef, {
      online: true,
      lastSeen: Date.now()
    });
  });
}