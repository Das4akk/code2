import { BackgroundFX } from './utils.js';
import { AppState } from './state.js';
import { AuthManager, DirectMessages, RoomManager } from './managers.js';

function bindModalClosers() {
  document.querySelectorAll('.btn-close-modal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (!modal) return;
      if (modal.id === 'modal-dm-chat') DirectMessages.closeChat();
      else modal.classList.remove('active');
    });
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target !== modal) return;
      if (modal.id === 'modal-dm-chat') DirectMessages.closeChat();
      else modal.classList.remove('active');
    });
  });
}

function bindMobileSidebarToggle() {
  const btnToggle = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('main-sidebar');
  if (!btnToggle || !sidebar) return;

  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target)) sidebar.classList.remove('open');
    }
  });
}

function setupMpaEnhancements(page) {
  const pageLinks = document.querySelectorAll('[data-nav-page]');
  pageLinks.forEach((link) => {
    if (link.dataset.navPage === page) link.classList.add('active-page-link');
  });

  if (page === 'profile') {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const trigger = document.getElementById('btn-open-my-profile');
      if (trigger) { trigger.click(); clearInterval(timer); }
      if (tries > 20) clearInterval(timer);
    }, 400);
  }

  if (page === 'room') {
    const params = new URLSearchParams(window.location.search);
    const targetRoomId = params.get('room') || sessionStorage.getItem('cow:lastRoomId');
    if (!targetRoomId) return;

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const roomData = AppState.roomsCache.get(targetRoomId);
      if (roomData) {
        clearInterval(timer);
        RoomManager.attemptJoinRoom(targetRoomId, roomData);
      }
      if (tries > 30) clearInterval(timer);
    }, 500);
  }
}

function initApp(page = 'home') {
  AuthManager.init();
  BackgroundFX.init();
  bindModalClosers();
  bindMobileSidebarToggle();
  setupMpaEnhancements(page);
}

export { initApp };
