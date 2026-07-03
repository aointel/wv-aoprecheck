import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Get list page to grab CSRF token
list_resp = opener.open('https://pod.planetaltig.com/Account/List')
list_content = list_resp.read().decode('utf-8', errors='replace')

# Find antiforgery token
token_match = re.search(r'__RequestVerificationToken[^"]*"[^"]*"([^"]+)"', list_content)
if not token_match:
    token_match = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', list_content)
if not token_match:
    # Try to find in cookies
    for cookie in cj:
        print(f'Cookie: {cookie.name} = {cookie.value[:30]}')

if token_match:
    token = token_match.group(1)
    print('Token found:', token[:30])
else:
    print('No token found in page')
    # Try without token - just different params
    pass

# Try with just minimal params, no CSRF
params = urllib.parse.urlencode([
    ('draw', '1'),
    ('start', '0'), ('length', '500'),
    ('search[value]', ''), ('search[regex]', 'false'),
    ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
    ('IsNewSearch', 'true'),
])

for status in ['AllActive', 'Active', '']:
    try:
        req = urllib.request.Request(
            f'https://pod.planetaltig.com/account/getUserList?userstatus={status}&SearchByRole=0&OfficeId=',
            data=params.encode(),
        )
        req.add_header('X-Requested-With', 'XMLHttpRequest')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
        resp = opener.open(req)
        content = resp.read().decode('utf-8', errors='replace')
        data = json.loads(content)
        print(f'status={status}: recordsTotal={data.get("recordsTotal")}, data={len(data.get("data",[]))}')
        if len(data.get('data', [])) > 0:
            print('First:', json.dumps(data['data'][0])[:200])
            break
    except Exception as e:
        print(f'status={status}: {e}')
