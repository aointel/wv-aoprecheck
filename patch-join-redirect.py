with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      setLocation('/dashboard');"
new = "      setLocation('/getting-started'); // new agents go through diagnostic/walkthrough first"

assert old in content, 'Pattern not found'
content = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
