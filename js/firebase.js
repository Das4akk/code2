import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue,
  onDisconnect,
  remove,
  update,
  onChildAdded,
  off,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
  authDomain: "das4akk-1.firebaseapp.com",
  databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
  projectId: "das4akk-1",
  storageBucket: "das4akk-1.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
window.db = db;
window.ref = ref;
window.set = set;
window.get = get;
window.push = push;
window.update = update;
window.remove = remove;
window.onValue = onValue;
window.off = off;
window.onDisconnect = onDisconnect;
window.firebaseRef = ref;
window.firebaseUpdate = update;
window.firebaseSet = set;
window.firebaseGet = get;
window.firebaseDatabase = {
  db,
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  off,
  onChildAdded,
  onDisconnect,
};

const AppState = {
  currentUser: null,
  currentRoomId: null,
  currentRoomJoinTs: 0, // Фикс синхронизации новых юзеров
  customBadges: {},
  currentTheme: null,
  globalTheme: "dark", // [NEW]
  isHost: false,
  isRegistering: false,
  usersCache: new Map(),
  roomsCache: new Map(),
  activeSubscriptions: [],
  roomSubscriptions: [],
  currentPresenceCache: {},
  rtc: {
    localStream: null,
    sessionId: null,
    peerConnections: new Map(),
    audioElements: new Map(),
    voiceParticipantsCache: {},
  },
  currentDirectChat: null,
  usersListRenderToken: 0,
  inviteCooldowns: new Map(),
  pendingRegistration: null,
  regResendTimer: null,
  admin: {
    settings: {
      roomCreationBlocked: false,
      globalChatLocked: false,
      globalReactionsBlocked: false,
      globalInvitesBlocked: false,
      globalRegistrationsBlocked: false, emailVerificationBlocked: false,
      maintenanceMode: false,
      systemReadOnlyMode: false,
    },
    lastAnnouncementId: null,
    activeSection: "dashboard",
    activeUsersTab: "online",
    logs: [],
    shadowbans: {},
    globalMute: false,
    spectators: {},
  },
  easterEggs: {
    activeEffects: new Map(),
    audioPool: new Set(),
    processedRoomEvents: new Set(),
    keyBuffer: "",
    lastKeyTs: 0,
    konamiIndex: 0,
    animationHandles: new Map(),
    notificationMutedUntil: 0,
    roomUnsub: null,
  },
  lumenTransactions: [],
  roomWatchEarnings: 0,
  roomWatchTicks: 0,
};

// ============================================================================
// 2. УТИЛИТЫ И GUI ФИКСЫ (Инъекция стилей, Анимации, Нейрофон)
// ============================================================================


window.initializeApp = initializeApp;
window.getAuth = getAuth;
window.getDatabase = getDatabase;
window.app = app;
window.auth = auth;
window.db = db;
window.ref = ref;
window.set = set;
window.get = get;
window.push = push;
window.update = update;
window.remove = remove;
window.onValue = onValue;
window.off = off;
window.onDisconnect = onDisconnect;
window.onChildAdded = onChildAdded;
window.onAuthStateChanged = onAuthStateChanged;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.updateProfile = updateProfile;
window.signInWithPopup = signInWithPopup;
window.GoogleAuthProvider = GoogleAuthProvider;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.EmailAuthProvider = EmailAuthProvider;
window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
window.AppState = AppState;

export {
  initializeApp,
  getAuth,
  getDatabase,
  app,
  auth,
  db,
  ref,
  set,
  get,
  push,
  onValue,
  onDisconnect,
  remove,
  update,
  onChildAdded,
  off,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
  AppState
};
