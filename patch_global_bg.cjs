const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// Looking at the screenshot, the black background might just be coming from global styles.
// The user wants the default "neuro-background" (canvas particles + premium black) to show.
// Make sure .lobby-layout and .rooms-main and .lobby-content all have transparent background
html = html.replace(/\.lobby-layout\s*\{[^}]*\}/, function(match) {
  if(match.includes('margin-top')) return match; // already modified
  return match.replace('}', ' background: transparent !important; }');
});

// There is a style inside index.html for .lobby-layout maybe? Let's aggressively force transparency
html = html.replace('</style>', `
  .lobby-layout, .rooms-main, .lobby-content, #section-profile, .tiktok-profile-container, .tiktok-profile-header, .tiktok-profile-info {
      background: transparent !important;
      background-color: transparent !important;
  }
</style>`);

fs.writeFileSync('index.html', html);
console.log("Forced transparency across all layout containers");
