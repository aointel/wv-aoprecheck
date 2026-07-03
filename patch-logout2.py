with open(r'C:\dev\AOIrail\client\src\hooks\use-auth.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 228 (0-indexed 227): await supabase.auth.signOut();
# Wrap it in try/catch
for i, line in enumerate(lines):
    if 'await supabase.auth.signOut();' in line:
        indent = '      '
        lines[i] = f'{indent}// Sign out from Supabase (best-effort — app uses express sessions, not Supabase JWT)\n{indent}try {{ await supabase.auth.signOut(); }} catch (_) {{}}\n'
        print(f'Patched line {i+1}')
        break

with open(r'C:\dev\AOIrail\client\src\hooks\use-auth.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
