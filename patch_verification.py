import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

verification_code = """
            <div id="platega-verification-block" style="text-align: center; color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 10px; padding: 10px; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;">
              Код проверки:<br><span id="platega-verification-text" style="color: rgba(255,255,255,0.6); font-weight: bold;">платега верификация</span>
            </div>
            """

content = content.replace('            <button class="secondary-btn" id="btn-switch-account"', verification_code + '            <button class="secondary-btn" id="btn-switch-account"')

# Let's also add the PLATEGA_VERIFICATION constant in a script tag early on
script_tag = """
    <script>
      const PLATEGA_VERIFICATION = true;
    </script>
"""
content = content.replace("  <head>", "  <head>" + script_tag)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
