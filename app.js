// app.js
import { initCore } from './core.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initCore();
});