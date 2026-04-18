// app.js
import { initCore } from './core.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Сначала запускаем движок (Firebase, WebRTC, State)
        await initCore();
        
        // 2. Затем натягиваем интерфейс на новые DOM элементы
        initUI();
        
        console.log('✅ COW System v2.0: Core & UI Initialized');
    } catch (error) {
        console.error('❌ Ошибка инициализации системы:', error);
    }
});