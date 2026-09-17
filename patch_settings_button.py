import re

with open('settingsRenderer.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add a check for `item.type === "button"`
# We can find `else if (item.type === "slider")` and add `else if (item.type === "button")` below it.
button_html = """      } else if (item.type === "button") {
        html += `
          <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'" id="${item.id}">
             <div style="display: flex; align-items: center; gap: 12px;">
               <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                 <img src="${item.icon}" style="width: 24px;">
               </div>
               <div>
                 <div style="font-weight: 700; font-size: 15px;">${item.title}</div>
                 <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${item.desc}</div>
               </div>
             </div>
             <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Travel%20and%20Places/Right%20Arrow.webp" style="width: 24px; opacity: 0.5;">
          </div>
        `;
"""

content = content.replace("    });\n    html += `</div></div>`;", button_html + "    });\n    html += `</div></div>`;")

# Add click event listener handler
event_listener_handler = """        } else if (item.type === "button") {
          el.addEventListener("click", (e) => {
            if (item.onClick) item.onClick();
          });
"""
content = content.replace("        } else if (item.type === \"slider\") {", event_listener_handler + "        } else if (item.type === \"slider\") {")

with open('settingsRenderer.js', 'w', encoding='utf-8') as f:
    f.write(content)
