with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert the isElectronRequest function before its first usage
marker = '// CRITICAL: Force Electron cookies to use SameSite=None; Secure'
insert = '''// Helper to detect Electron requests via User-Agent or explicit desktop header.
function isElectronRequest(req: any): boolean {
  const ua = req.headers['user-agent'] || '';
  const desktopHeader = `${req.headers['x-desktop-app'] || ''}`.toLowerCase();
  return ua.includes('AOI-Desktop') || ua.includes('Electron') || desktopHeader === 'true' || desktopHeader === '1';
}

'''

new_content = content.replace(marker, insert + marker, 1)
assert new_content != content, "Replacement failed - marker not found"

with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Done.')
