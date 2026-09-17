import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

script_tag = """<head>
    <script>
      const PLATEGA_VERIFICATION = true;
    </script>"""

content = content.replace("<head>", script_tag, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
