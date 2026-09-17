import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
"""      #particle-canvas {
        position: fixed;
        top: 0;
        left: 0;
        z-index: -1;
        width: 100%;
        height: 100%;
        opacity: 0.2;
        pointer-events: none;
        filter: blur(0.3px);
      }""",
"""      #particle-canvas {
        position: fixed;
        top: 0;
        left: 0;
        z-index: -1;
        width: 100%;
        height: 100%;
        opacity: 0.2;
        pointer-events: none;
        filter: blur(0.3px);
        transition: filter 1s ease, opacity 1s ease;
      }""")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
