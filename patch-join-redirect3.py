with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      setLocation('/onboarding'); // new agents go through startup diagnostic"
new = "      setLocation('/connect'); // startup diagnostic runs automatically on first load of /connect"

assert old in content
content = content.replace(old, new, 1)
with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
