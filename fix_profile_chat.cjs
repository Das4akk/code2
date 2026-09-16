const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

// There is an issue where clicking on a message author in chat does not open the profile modal
// Let's check how chat messages are handled.
// Wait, chat messages click:
const oldChatClick = `          btn.onclick = () => ProfileManager.openViewProfileModal(msg.uid);`;
const newChatClick = `          btn.onclick = () => ProfileManager.openViewProfileModal(msg.uid);`; // It was correct, but maybe the modal didn't open properly in room. I just fixed openViewProfileModal! So it should work now.

// Wait, the user said "Профили нигде не открываются, ни с сообщения пользователя из чата ни с автора комнаты под названием."
// This means openViewProfileModal was entirely broken. I just rewrote openViewProfileModal to work in room!
