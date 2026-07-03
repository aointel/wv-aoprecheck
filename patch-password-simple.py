"""
Password = associate ID zero-padded to 6 digits.
1253 → 001253, 123456 → 123456, 3 → 000003
User types their raw associate ID, we pad before the API call.
"""

# Server: provision-agent
with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "    const password = String(agentAssociateId) + 'aoi'; // Supabase requires 6+ chars; suffix 'aoi' is consistent and not user-visible"
new = "    const password = String(agentAssociateId).padStart(6, '0'); // zero-pad to meet Supabase 6-char min; user types raw ID"

assert old in content
content = content.replace(old, new, 1)
with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Server fixed')

# Client: JoinPage - auto-login after signup
with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      await login(email, associateId + 'aoi'); // password = associateId + 'aoi' suffix (matches server)"
new = "      await login(email, associateId.padStart(6, '0')); // zero-padded to match server password"

assert old in content
content = content.replace(old, new, 1)
with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('JoinPage fixed')

# Client: Login page - user types their associate ID, we pad before sending
with open(r'C:\dev\AOIrail\client\src\pages\Login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      await login(normalizedEmail, password + 'aoi'); // passwords stored as associateId+'aoi'"
new = "      await login(normalizedEmail, password.padStart(6, '0')); // zero-pad to match how passwords are stored"

assert old in content
content = content.replace(old, new, 1)
with open(r'C:\dev\AOIrail\client\src\pages\Login.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Login.tsx fixed')
