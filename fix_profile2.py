import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    return """       sProfile.style.setProperty("position", "fixed", "important");
       sProfile.style.setProperty("top", "50%", "important");
       sProfile.style.setProperty("left", "50%", "important");
       sProfile.style.setProperty("transform", "translate(-50%, -50%)", "important");
       sProfile.style.setProperty("width", "95%", "important");
       sProfile.style.setProperty("max-width", "600px", "important");
       sProfile.style.setProperty("height", "85vh", "important");
       sProfile.style.setProperty("max-height", "800px", "important");
       sProfile.style.setProperty("z-index", "99999", "important");
       sProfile.style.setProperty("background", "rgba(10, 10, 10, 0.98)", "important");
       sProfile.style.setProperty("border-radius", "16px", "important");
       sProfile.style.setProperty("box-shadow", "0 20px 60px rgba(0,0,0,0.9)", "important");
       sProfile.style.setProperty("border", "1px solid rgba(255,255,255,0.1)", "important");
       sProfile.style.setProperty("backdrop-filter", "blur(20px)", "important");
       sProfile.style.setProperty("display", "flex", "important");
       sProfile.style.setProperty("flex-direction", "column", "important");"""

content = re.sub(r'sProfile\.style\.setProperty\("position", "fixed", "important"\);[\s\S]*?sProfile\.style\.display = "flex";', replacer, content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
