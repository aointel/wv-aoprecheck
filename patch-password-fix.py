import re

# Fix server: password = associateId + 'aoi' (ensures 6+ chars, consistent)
with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "    const password = String(agentAssociateId).padEnd(6, '0'); // Supabase requires min 6 chars; associate IDs are the passcode"
new = "    const password = String(agentAssociateId) + 'aoi'; // Supabase requires 6+ chars; suffix 'aoi' is consistent and not user-visible"

assert old in content, 'server pattern not found'
content = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Server fixed')

# Fix client JoinPage: login(email, associateId + 'aoi')
with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_client = "      await login(email, associateId);"
new_client = "      await login(email, associateId + 'aoi'); // password = associateId + 'aoi' suffix (matches server)"

assert old_client in content, 'client JoinPage pattern not found'
content = content.replace(old_client, new_client, 1)

with open(r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('JoinPage fixed')

# Fix client Login.tsx: the "Passcode" field — user types their associate ID
# The login form sends the raw value as password, but we need to append 'aoi'
# Find the login form submit handler
with open(r'C:\dev\AOIrail\client\src\pages\Login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The login hook already calls /api/auth/login with email+password as-is
# We need to intercept the password field and append 'aoi' before submitting
# Find where login() is called with password
old_login = "      await login(normalizedEmail, password);"
new_login = "      await login(normalizedEmail, password + 'aoi'); // passwords stored as associateId+'aoi'"

if old_login in content:
    content = content.replace(old_login, new_login, 1)
    print('Login.tsx fixed')
else:
    print('WARNING: Login.tsx pattern not found - check manually')

with open(r'C:\dev\AOIrail\client\src\pages\Login.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
