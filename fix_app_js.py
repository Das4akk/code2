import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Current logic:
#    document.body.classList.remove(
#      "theme-love-room",
#      "theme-inverted-room",
#      "theme-light-room",
#    );

# We need to remove all theme-*-room from body
remove_block = """    document.body.classList.remove(
      "theme-love-room",
      "theme-inverted-room",
      "theme-light-room",
    );"""

new_remove_block = """    document.body.className = Array.from(document.body.classList).filter(c => !c.startsWith("theme-") || !c.endsWith("-room")).join(" ");"""

content = content.replace(remove_block, new_remove_block)

# Add logic for all themes
#    if (safeTheme === "love") {
#      roomScreen.classList.add("theme-love");
#      document.body.classList.add("theme-love-room");

def replace_theme_add(match):
    return """    if (safeTheme !== "default") {
      roomScreen.classList.add(`theme-${safeTheme}`);
      document.body.classList.add(`theme-${safeTheme}-room`);
    }
    if (safeTheme === "love") {
      this.startLoveHearts();
      setTimeout(() => this.startLoveHearts(), 150);
    }"""

old_add_block = r"""    if \(safeTheme === "love"\) \{\s*roomScreen\.classList\.add\("theme-love"\);\s*document\.body\.classList\.add\("theme-love-room"\);\s*this\.startLoveHearts\(\);\s*setTimeout\(\(\) => this\.startLoveHearts\(\), 150\);\s*\} else \{\s*if \(safeTheme === "inverted"\)\s*document\.body\.classList\.add\("theme-inverted-room"\);\s*if \(safeTheme === "light"\)\s*document\.body\.classList\.add\("theme-light-room"\);\s*if \(safeTheme !== "default"\)\s*roomScreen\.classList\.add\(`theme-\$\{safeTheme\}`\);\s*\}"""

content = re.sub(old_add_block, """    if (safeTheme !== "default") {
      roomScreen.classList.add(`theme-${safeTheme}`);
      document.body.classList.add(`theme-${safeTheme}-room`);
    }
    if (safeTheme === "love") {
      this.startLoveHearts();
      setTimeout(() => this.startLoveHearts(), 150);
    }""", content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
