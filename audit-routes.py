import re

with open(r'C:\dev\AOIrail\server\routes.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

twilio_voice = []
dialer = []
reporting = []
auth_routes = []
other_api = []

for i, line in enumerate(lines):
    s = line.strip()
    if not (s.startswith('app.') and any(x in s for x in ['get(', 'post(', 'all(', 'put(', 'delete(', 'patch('])):
        continue
    m = re.search(r"app\.\w+\(['\"]([^'\"]+)", s)
    path = m.group(1) if m else '?'
    method = re.search(r'app\.(\w+)\(', s)
    method_str = method.group(1).upper() if method else '?'
    entry = f'{i+1}: {method_str} {path}'

    if any(x in path for x in ['/incomingcall', '/webhook', '/api/twilio/', '/voice', '/lead-join', '/agent-join', '/api/verification/call', '/twilio', '/zapier', '/cs-bot', '/api/twilio/enqueue', '/api/twilio/call-status', '/api/twilio/test']):
        twilio_voice.append(entry)
    elif any(x in path for x in ['/api/dial', '/api/twilio/token', '/api/electron/twilio', '/api/agents/voice', '/api/outbound', '/api/webrtc']):
        dialer.append(entry)
    elif any(x in path for x in ['/api/live-call-board', '/api/dashboard', '/api/connectnow-analytics', '/api/leaderboard', '/api/war', '/api/billing', '/api/manager', '/api/reports', '/api/connectnow/user-credits', '/api/war-stats', '/api/war-system']):
        reporting.append(entry)
    elif any(x in path for x in ['/api/auth', '/api/login', '/api/logout', '/api/signup', '/api/session', '/api/password', '/api/walkthrough', '/api/register', '/api/verify-email', '/api/reset']):
        auth_routes.append(entry)
    else:
        other_api.append(entry)

print('=== TWILIO VOICE INGRESS ===')
for x in twilio_voice: print('  ' + x)
print(f'\n=== DIALER API ({len(dialer)}) ===')
for x in dialer: print('  ' + x)
print(f'\n=== REPORTING/DASHBOARD ({len(reporting)}) ===')
for x in reporting: print('  ' + x)
print(f'\n=== AUTH ({len(auth_routes)}) ===')
for x in auth_routes: print('  ' + x)
print(f'\n=== OTHER API ({len(other_api)}) ===')
for x in other_api[:30]: print('  ' + x)
if len(other_api) > 30:
    print(f'  ... and {len(other_api)-30} more')

print(f'\nTOTALS: voice={len(twilio_voice)} dialer={len(dialer)} reporting={len(reporting)} auth={len(auth_routes)} other={len(other_api)}')
