import { db, ref, set, onValue } from './firebase.js';

let player, roomId, userId;
let isRemote = false;

export function initPlayerSync(video, rId, uId) {
  player = video;
  roomId = rId;
  userId = uId;

  const stateRef = ref(db, `rooms/${roomId}/player`);

  onValue(stateRef, (snap) => {
    const s = snap.val();
    if (!s) return;

    isRemote = true;

    if (Math.abs(player.currentTime - s.time) > 1) {
      player.currentTime = s.time;
    }

    if (s.playing) {
      player.play().catch(()=>{});
    } else {
      player.pause();
    }

    isRemote = false;
  });

  player.addEventListener('play', () => update(true));
  player.addEventListener('pause', () => update(false));
  player.addEventListener('seeked', () => update(!player.paused));
}

function update(playing) {
  if (isRemote) return;

  set(ref(db, `rooms/${roomId}/player`), {
    playing,
    time: player.currentTime,
    updated: Date.now(),
    user: userId
  });
}