// ==========================================
// FILE: app.core.js
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, get, onValue, onChildAdded, onDisconnect, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
window.auth = getAuth(app);
window.db = getDatabase(app);

setPersistence(window.auth, browserLocalPersistence);

// --- GLOBAL STATE ---
window.AppState = {
    roomsCache: {},
    currentRoomId: null,
    isHost: false,
    myStream: null,
    activeCalls: new Set(),
    currentPresenceCache: {},
    latestRoomPresenceData: {},
    onlineUsersCache: {},
    voiceSessionId: null,
    voiceParticipantsCache: {},
    voicePeerConnections: new Map(),
    remoteAudioAnalyzers: new Map(),
    isRemoteAction: false,
    lastSyncTs: 0,
    processedMsgs: new Set(),
    teardownFuncs: [],
    roomEnteredAt: 0,
    currentDirectChat: null,
    roomProfileSubscriptions: new Map(),
    friendProfileSubscriptions: new Map(),
    editingRoomId: null,
    pendingJoin: null
};

// --- CORE UTILS ---
window.$ = (id) => document.getElementById(id);

window.escapeHtml = (str) => {
    return String(str || '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[s]);
};

window.showToast = (message) => {
    const container = window.$('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
};

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (window.$(id)) window.$(id).classList.add('active');
};

window.getDisplayName = () => {
    return window.auth.currentUser?.displayName || window.auth.currentUser?.email || 'User';
};

window.isAcceptedFriendRecord = (record) => {
    return record === true || (record && record.status === 'accepted');
};

window.getDefaultRoomPerms = (host = false) => {
    return { chat: true, voice: true, player: !!host, reactions: true };
};

window.getEffectiveRoomPerms = (node, host = false) => {
    return host ? { chat: true, voice: true, player: true, reactions: true } : { ...window.getDefaultRoomPerms(false), ...(node?.perms || {}) };
};

// --- CRYPTO UTILS ---
window.bufToBase64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

window.base64ToBuf = (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

window.genSalt = (len = 16) => {
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return window.bufToBase64(a.buffer);
};

window.deriveKey = async (password, saltBase64, iterations = 10000) => {
    const enc = new TextEncoder();
    const salt = window.base64ToBuf(saltBase64);
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    return window.bufToBase64(derivedBits);
};

// --- AUTH STATE OBSERVER ---
onAuthStateChanged(window.auth, (user) => {
    if (user) {
        if (window.$('user-display-name')) {
            window.$('user-display-name').innerText = user.displayName || user.email;
        }
        if (!window.AppState.currentRoomId) {
            window.showScreen('lobby-screen');
            if (typeof window.setupLobbyNotifications === 'function') window.setupLobbyNotifications();
            if (typeof window.bindSelfPresence === 'function') window.bindSelfPresence();
            if (typeof window.subscribeToOwnProfile === 'function') window.subscribeToOwnProfile();
            if (typeof window.syncRooms === 'function') window.syncRooms();
        }
    } else {
        window.showScreen('auth-screen');
    }
});

window.signInEmail = async (email, password) => {
    try { await signInWithEmailAndPassword(window.auth, email, password); } catch (e) { window.showToast("Ошибка: " + e.message); }
};
window.registerEmail = async (email, password, name) => {
    try {
        const res = await createUserWithEmailAndPassword(window.auth, email, password);
        await updateProfile(res.user, { displayName: name });
        if (window.$('user-display-name')) window.$('user-display-name').innerText = name;
    } catch (e) { window.showToast("Ошибка: " + e.message); }
};
window.signInGoogle = async () => {
    try { await signInWithPopup(window.auth, new GoogleAuthProvider()); } catch (e) { window.showToast("Ошибка Google"); }
};
window.logoutUser = () => signOut(window.auth);