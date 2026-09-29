import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, AppState } from '../js/firebase.js';

export type ScreenType = 'auth' | 'lobby' | 'room';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('auth');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Toggle DOM screen visibility based on currentScreen state variable
  useEffect(() => {
    const screenMap: Record<ScreenType, string> = {
      auth: 'auth-screen',
      lobby: 'lobby-screen',
      room: 'room-screen',
    };

    Object.entries(screenMap).forEach(([screenKey, elementId]) => {
      const el = document.getElementById(elementId);
      if (el) {
        if (screenKey === currentScreen) {
          el.classList.add('active');
          el.style.display = 'flex';
        } else {
          el.classList.remove('active');
          el.style.display = 'none';
        }
      }
    });

    if (typeof window !== 'undefined') {
      (window as any).__COWIO_CURRENT_REACT_SCREEN = currentScreen;
      (window as any).currentReactScreen = currentScreen;
    }
  }, [currentScreen]);

  // Authentication-driven screen switching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) {
        setCurrentScreen('auth');
      } else {
        const isRoomRoute =
          window.location.pathname.startsWith('/room/') ||
          Boolean(AppState?.currentRoomId);
        setCurrentScreen(isRoomRoute ? 'room' : 'lobby');
      }
    });

    // Custom event listener for programmatic screen switches
    const handleScreenSwitch = (e: Event) => {
      const customEvent = e as CustomEvent<{ screen: ScreenType }>;
      if (customEvent.detail?.screen && ['auth', 'lobby', 'room'].includes(customEvent.detail.screen)) {
        setCurrentScreen(customEvent.detail.screen);
      }
    };

    window.addEventListener('cowio:switchScreen', handleScreenSwitch);

    // Global bridge for vanilla JS subsystems
    if (typeof window !== 'undefined') {
      (window as any).setReactScreen = (screen: ScreenType) => {
        if (['auth', 'lobby', 'room'].includes(screen)) {
          setCurrentScreen(screen);
        }
      };
    }

    return () => {
      unsubscribe();
      window.removeEventListener('cowio:switchScreen', handleScreenSwitch);
    };
  }, []);

  return null;
}
