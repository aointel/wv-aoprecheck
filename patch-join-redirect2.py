with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      setLocation('/getting-started'); // new agents go through diagnostic/walkthrough first"
new = "      setLocation('/onboarding'); // new agents go through startup diagnostic"

assert old in content
content = content.replace(old, new, 1)
with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
