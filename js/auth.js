import { auth, googleProvider } from 'JS/firebase.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Измени: import { UI } from 'JS/js/ui.js';
import { UI } from 'js/ui.js';
export const AuthSystem = {
    /**
     * @param {Function} onLoginCallback - Вызывается при успешном входе
     * @param {Function} onLogoutCallback - Вызывается при выходе
     */
    init(onLoginCallback, onLogoutCallback) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                onLoginCallback(user);
            } else {
                onLogoutCallback();
            }
        });
    },

    async loginWithEmail(email, password) {
        try {
            if (!email || !password) throw new Error("Заполните email и пароль");
            await signInWithEmailAndPassword(auth, email.trim(), password);
            UI.showToast("Успешный вход!");
        } catch (e) {
            this._handleError(e, "Ошибка входа");
        }
    },

    async registerWithEmail(name, email, password) {
        try {
            if (!name || !email || !password) throw new Error("Заполните все поля");
            if (password.length < 6) throw new Error("Пароль минимум 6 символов");
            
            const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
            await updateProfile(res.user, { displayName: name.trim() });
            
            UI.showToast("Аккаунт создан!");
        } catch (e) {
            this._handleError(e, "Ошибка регистрации");
        }
    },

    async loginWithGoogle() {
        try {
            await signInWithPopup(auth, googleProvider);
            UI.showToast("Вход через Google успешен!");
        } catch (e) {
            this._handleError(e, "Ошибка Google авторизации");
        }
    },

    async logout() {
        try {
            await signOut(auth);
            UI.showToast("Вы вышли из системы");
        } catch (e) {
            UI.showToast("Ошибка при выходе");
        }
    },

    _handleError(error, defaultMsg) {
        console.error(defaultMsg, error);
        let msg = error.message || defaultMsg;
        if (msg.includes('invalid-credential')) msg = "Неверный email или пароль";
        if (msg.includes('email-already-in-use')) msg = "Email уже используется";
        UI.showToast(msg);
    }
};