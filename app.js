import { initCore } from './core.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализируем UI немедленно, чтобы кнопки подцепились
    initUI();
    
    // 2. Запускаем ядро (оно само дернет событие authChanged, когда юзер найдется)
    initCore().catch(err => {
        console.error("Критическая ошибка ядра:", err);
    });
});