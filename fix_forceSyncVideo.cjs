const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');
const syncCode = fs.readFileSync('forceSyncVideo.txt', 'utf8').replace(/  static startRoomExperienceTimer\(\) \{[\s\S]*/, '');

if (js.includes('static forceSyncVideo')) {
    console.log("Already has forceSyncVideo, skipping or replacing");
    // js = js.replace(/static forceSyncVideo[\s\S]*?(?=  static startRoomExperienceTimer)/, syncCode);
} else {
    js = js.replace('  static startRoomExperienceTimer() {', syncCode + '\n  static startRoomExperienceTimer() {');
}

fs.writeFileSync('app.js', js);
