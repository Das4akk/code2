import re

def replace_in_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace("cowiosupport@gmail.com", "support@cowio.com")
    content = content.replace("das4akk@gmail.com", "support@cowio.com")

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

replace_in_file('server.js')
replace_in_file('serviceAccountKey.json')
replace_in_file('app.js')

