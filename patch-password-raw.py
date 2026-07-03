files = [
    (r'C:\dev\AOIrail\server\routes-agent-provision.ts',
     "    const password = String(agentAssociateId).padStart(6, '0'); // zero-pad to meet Supabase 6-char min; user types raw ID",
     "    const password = String(agentAssociateId);"),
    (r'C:\dev\AOIrail\client\src\pages\JoinPage.tsx',
     "      await login(email, associateId.padStart(6, '0')); // zero-padded to match server password",
     "      await login(email, associateId);"),
    (r'C:\dev\AOIrail\client\src\pages\Login.tsx',
     "      await login(normalizedEmail, password.padStart(6, '0')); // zero-pad to match how passwords are stored",
     "      await login(normalizedEmail, password);"),
]

for path, old, new in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert old in content, f'Pattern not found in {path}'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'Fixed: {path.split(chr(92))[-1]}')
