import re

with open('premiumManager.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Make canUseTheme always return true
content = re.sub(r'static canUseTheme\([^)]*\)\s*{[^}]*}', 'static canUseTheme(themeKey, profile, uid) { return true; }', content)

# Make updateThemeButtons not check premium
old_update_theme = """      ["btn-room-theme-toggle", "btn-dm-theme-toggle"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (isPremium) {
          btn.classList.remove("premium-locked-theme");
          btn.innerHTML = "Поменять тему";
          btn.style.opacity = "1";
        } else {
          btn.classList.add("premium-locked-theme");
          btn.innerHTML =
            '<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;"><span style="position:relative;display:inline-flex;align-items:center;justify-content:center;"><span style="filter:blur(3px);opacity:0.3;position:absolute;">Поменять тему</span><span style="font-size:11px;font-weight:700;white-space:nowrap;color:#ffe6a0;position:relative;z-index:1;">Приобретите Premium</span></span>';
          btn.style.opacity = "0.9";
        }
      });"""

new_update_theme = """      ["btn-room-theme-toggle", "btn-dm-theme-toggle"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove("premium-locked-theme");
        btn.innerHTML = "Поменять тему";
        btn.style.opacity = "1";
      });"""

content = content.replace(old_update_theme, new_update_theme)

with open('premiumManager.js', 'w', encoding='utf-8') as f:
    f.write(content)
