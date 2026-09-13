const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf-8');

const targetStr = `static async openViewProfileModal(targetUid) {`;
const replaceStr = `static async openViewProfileModal(targetUid) {
  try {`;

const endTarget = `Utils.$("btn-remove-partner").onclick = async () => {`;
// Actually, it's safer to wrap the body in a try catch manually.
