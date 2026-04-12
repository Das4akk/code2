import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase, ref, set, onValue, push, update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* FIREBASE */
const app = initializeApp({
  apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
  authDomain: "das4akk-1.firebaseapp.com",
  databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
  projectId: "das4akk-1",
  appId: "1:631019796218:web:df72851c938bdc9a497b43"
});

const db = getDatabase(app);
const auth = getAuth(app);

/* STATE */
let userName = "";
let currentRoom = "";
let isHost = false;

/* SCREENS */
const screens = {
  auth: document.getElementById("authScreen"),
  lobby: document.getElementById("lobbyScreen"),
  room: document.getElementById("roomScreen")
};

function show(screen) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

/* AUTH */
document.getElementById("loginBtn").onclick = async () => {
  userName = document.getElementById("username").value || "Guest";
  await signInAnonymously(auth);
  loadRooms();
  show(screens.lobby);
};

/* LOBBY */
const roomList = document.getElementById("roomList");

function loadRooms() {
  onValue(ref(db, "rooms"), snapshot => {
    roomList.innerHTML = "";
    snapshot.forEach(child => {
      const roomId = child.key;
      const el = document.createElement("div");
      el.className = "room-card glass";
      el.innerText = roomId;
      el.onclick = () => joinRoom(roomId);
      roomList.appendChild(el);
    });
  });
}

document.getElementById("createRoomBtn").onclick = () => {
  const id = "room-" + Date.now();
  set(ref(db, "rooms/" + id), {
    host: auth.currentUser.uid
  });
  joinRoom(id, true);
};

/* ROOM */
const video = document.getElementById("videoPlayer");
const vlock = document.getElementById("vlock");

function joinRoom(id, host = false) {
  currentRoom = id;
  isHost = host;
  show(screens.room);

  video.src = "https://www.w3schools.com/html/mov_bbb.mp4";

  if (!isHost) {
    vlock.style.pointerEvents = "all";
  } else {
    vlock.style.pointerEvents = "none";
  }

  syncVideo();
  loadChat();
}

/* SYNC */
function syncVideo() {
  const stateRef = ref(db, `rooms/${currentRoom}/state`);

  if (isHost) {
    video.addEventListener("play", sendState);
    video.addEventListener("pause", sendState);
    video.addEventListener("seeked", sendState);
  } else {
    onValue(stateRef, snap => {
      const data = snap.val();
      if (!data) return;

      if (Math.abs(video.currentTime - data.time) > 2) {
        video.currentTime = data.time;
      }

      if (data.paused) video.pause();
      else video.play();
    });
  }
}

function sendState() {
  update(ref(db, `rooms/${currentRoom}/state`), {
    time: video.currentTime,
    paused: video.paused
  });
}

/* CHAT */
const chatBox = document.getElementById("chatMessages");
const input = document.getElementById("chatInput");

document.getElementById("sendBtn").onclick = sendMessage;

function sendMessage() {
  if (!input.value) return;
  push(ref(db, `rooms/${currentRoom}/chat`), {
    user: userName,
    text: input.value
  });
  input.value = "";
}

function loadChat() {
  onValue(ref(db, `rooms/${currentRoom}/chat`), snap => {
    chatBox.innerHTML = "";
    snap.forEach(msg => {
      const m = msg.val();
      const div = document.createElement("div");
      div.innerText = `${m.user}: ${m.text}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}