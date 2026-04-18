// app.js
import { subscribeToOwnProfile, initCoreComponents } from './core.js';
import { 
    bindDirectChatUiV2, 
    bindSelfPresence, 
    bindCreateModalOverrides, 
    widenLobbyLayout,
    renderInitialUI 
} from './ui.js';

/**
 * Главный bootstrap-файл приложения.
 * Отвечает ТОЛЬКО за инициализацию и связывание слоев core и ui.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация базового UI и слушателей
    renderInitialUI();
    bindDirectChatUiV2();
    bindSelfPresence();
    bindCreateModalOverrides();
    widenLobbyLayout();

    // 2. Инициализация бизнес-логики и подписок
    initCoreComponents();
    subscribeToOwnProfile();
});