with open(r'C:\dev\AOIrail\client\src\hooks\use-auth.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const logout = async () => {
    try {
      // Sign out from Supabase first
      await supabase.auth.signOut();

      // Then sign out from our backend
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });"""

new = """  const logout = async () => {
    try {
      // Sign out from Supabase (best-effort — app uses express sessions, not Supabase JWT)
      try { await supabase.auth.signOut(); } catch (_) {}

      // Sign out from backend (destroys express session + clears cookie)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });"""

assert old in content, 'logout pattern not found'
result = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\client\src\hooks\use-auth.tsx', 'w', encoding='utf-8') as f:
    f.write(result)
print('Done')
