import sys

with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find gate block boundaries
gate_start = None
gate_end = None
for i, line in enumerate(lines):
    if '// ── Electron-only gate' in line and gate_start is None:
        gate_start = i
    if gate_start is not None and gate_end is None:
        # End marker: the line after the closing }); of the gate middleware
        if i > gate_start and line.strip() == '});' :
            gate_end = i
            break

print(f'Gate block: lines {gate_start+1} to {gate_end+1}')
print('First line:', lines[gate_start].rstrip())
print('Last line:', lines[gate_end].rstrip())

# Build the replacement
replacement = '''// Session store — initialized here so the gate below can read session user email
const MemoryStore = (session as any).MemoryStore;
export const sessionStore = MemoryStore ? new MemoryStore() : undefined;

// Session middleware — must run BEFORE the Electron-only gate so the gate can
// check req.session.user?.email for browser-exception users.
app.use(session({
  store: sessionStore ?? undefined,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// ── Electron-only gate ───────────────────────────────────────────────────────
// Block all browser (non-Electron) access to the app.
// Only /downloads* and API/webhook/asset routes pass through.
// This forces agents to use the Desktop App.
//
// BROWSER EXCEPTIONS — these email accounts are allowed through on a regular browser:
const BROWSER_EXCEPTION_EMAILS = new Set([
  'cnsysop@aoglobelife.com',
  'andyaltig@aoglobelife.com',
  'markneison@aoglobelife.com',
  'brettmacannell@aoglobelife.com',
  'richiealtig@aoglobelife.com',
]);

app.use((req: Request, res: Response, next: NextFunction) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();

  // Only block known browsers (Chrome, Safari, Firefox, Edge) that are NOT Electron
  const isElectron = ua.includes('electron') || ua.includes('aoielectron');
  const isBrowser = !isElectron && (
    ua.includes('chrome') || ua.includes('safari') || ua.includes(' edg/')
  );

  if (!isBrowser) return next();

  // Always allow: API routes, health, downloads, assets, webhooks
  if (req.path.startsWith('/api/') || req.path.startsWith('/agent/') || req.path.startsWith('/auth/')) return next();
  if (req.path === '/health' || req.path.startsWith('/downloads') || req.path.startsWith('/uploads') || req.path.startsWith('/assets') || req.path.startsWith('/attached_assets')) return next();
  if (req.path.startsWith('/verify') || req.path.startsWith('/agent-verify') || req.path.startsWith('/client-verify')) return next();
  if (req.path.startsWith('/recruit-journey') || req.path.startsWith('/recruit/waiting')) return next();
  if (req.path.startsWith('/dashboard/aoi-precheck-admin')) return next();
  if (req.path.startsWith('/twilio') || req.path.startsWith('/zapier') || req.path.startsWith('/webhook') || req.path.startsWith('/cs-bot')) return next();
  if (/\.(js|css|png|svg|ico|woff2?|ttf|map|json|webp|jpg|gif|txt)$/i.test(req.path)) return next();

  // Allow browser-exception users (check session email set during login)
  const sessionEmail: string | undefined = (req.session as any)?.user?.email;
  if (sessionEmail && BROWSER_EXCEPTION_EMAILS.has(sessionEmail.toLowerCase().trim())) {
    return next();
  }

  // Browser hitting a page route → redirect to downloads
  console.log(`[gate] BLOCKED browser ${req.method} ${req.path} UA="${req.headers['user-agent']}"`);
  return res.redirect(302, '/downloads');
});
'''

new_lines = lines[:gate_start] + [replacement] + lines[gate_end+1:]
print(f'Original lines: {len(lines)}, New lines: {len(new_lines)}')

with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Done.')
