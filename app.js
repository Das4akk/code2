// app.js
import { initCore } from './core.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 COW: Запуск инициализации...');
    initUI();
    initCore();
});