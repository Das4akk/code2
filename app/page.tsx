'use client';

import { useEffect } from 'react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#070707] text-white p-8">
      <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
        Cowio – Next.js Rewrite
      </h1>
      <p className="text-gray-400 text-center max-w-2xl mb-8 leading-relaxed">
        Вы запросили перенос приложения на архитектуру Next.js/React. Исходный код вашего проекта содержит более 8 000 строк манипуляций с DOM (Vanilla JS) и сложный HTML.
        Для полноценной работы в Next.js проект требует полного рефакторинга на компоненты React, состояние (useState/Context), и API-роуты. 
      </p>
      
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-semibold mb-4 text-violet-400">План миграции</h2>
        <ul className="space-y-3 text-sm text-gray-300">
          <li className="flex gap-3">
            <span className="text-gray-500">1.</span>
            <span>Создание структуры компонентов (Модалки, Чат, Плеер, Сайдбар).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-gray-500">2.</span>
            <span>Перенос авторизации и Firebase Realtime Database в хуки React.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-gray-500">3.</span>
            <span>Интеграция видео-плееров (YouTube/Rutube) через React-обертки.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-gray-500">4.</span>
            <span>Перенос стилей в Tailwind CSS (глобальные темы Next.js).</span>
          </li>
        </ul>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Укажите, с какой части вы хотите начать перенос, или дайте команду начать с базовой авторизации. Старый код (app.js / index.html) временно сохранен в корне.
      </p>
    </div>
  );
}
