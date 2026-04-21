import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile,
  signInWithPopup, GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getDatabase, ref, set, get, push, onValue, onDisconnect,
  remove, update, onChildAdded, off
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCby2qPGnlHWRfxWAI3Y2aK_UndEh9nato',
  authDomain: 'das4akk-1.firebaseapp.com',
  databaseURL: 'https://das4akk-1-default-rtdb.firebaseio.com',
  projectId: 'das4akk-1',
  storageBucket: 'das4akk-1.firebasestorage.app'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export {
  app, auth, db,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile,
  signInWithPopup, GoogleAuthProvider,
  ref, set, get, push, onValue, onDisconnect, remove, update, onChildAdded, off
};
