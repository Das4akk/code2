import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make all theme backgrounds transparent on #room-screen
# so the neuro-background shines through!
themes_to_clear = ['aurora', 'sunset', 'ocean', 'love', 'inverted', 'light']

for t in themes_to_clear:
    # replace `#room-screen.theme-aurora { background: ... ; }` with transparent
    # but be careful with regex.
    # Actually, we can just append an override!
    pass

css_override = """
      /* OVERRIDE OPAQUE BACKGROUNDS TO SHOW NEURO-BACKGROUND */
      #room-screen.theme-aurora,
      #room-screen.theme-sunset,
      #room-screen.theme-ocean,
      #room-screen.theme-love,
      #room-screen.theme-inverted,
      #room-screen.theme-light {
        background: transparent !important;
      }

      /* Adjust Particle Colors per Theme */
      body.theme-aurora-room #particle-canvas { filter: sepia(1) hue-rotate(200deg) saturate(3) brightness(1.2); }
      body.theme-sunset-room #particle-canvas { filter: sepia(1) hue-rotate(330deg) saturate(3) brightness(1.2); }
      body.theme-ocean-room #particle-canvas { filter: sepia(1) hue-rotate(180deg) saturate(2) brightness(1.2); }
      body.theme-love-room #particle-canvas { filter: sepia(1) hue-rotate(300deg) saturate(2) brightness(1.2); }
      
      body.theme-inverted-room #particle-canvas,
      body.theme-light-room #particle-canvas {
         /* White background for light themes */
         filter: invert(1) brightness(0.9);
      }
"""

content = content.replace("/* ========================================================= */\n      /* SCREENS & AUTH */", css_override + "\n      /* ========================================================= */\n      /* SCREENS & AUTH */")

# Remove body.theme-light-room #particle-canvas { filter: brightness(0); opacity: 0.38; } if it exists
content = re.sub(r'body\.theme-light-room #particle-canvas\s*\{[^}]*\}', '', content)
content = re.sub(r'body\.theme-inverted-room #particle-canvas\s*\{[^}]*\}', '', content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
