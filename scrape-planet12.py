import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# DataTables server-side POST with proper params
# draw, columns[], order[], start, length are standard DT params
params = urllib.parse.urlencode([
    ('draw', '1'),
    ('columns[0][data]', '0'),
    ('columns[0][name]', ''),
    ('columns[0][searchable]', 'true'),
    ('columns[0][orderable]', 'false'),
    ('columns[0][search][value]', ''),
    ('columns[1][data]', '1'),
    ('columns[1][name]', ''),
    ('columns[1][searchable]', 'true'),
    ('columns[1][orderable]', 'true'),
    ('columns[1][search][value]', ''),
    ('order[0][column]', '1'),
    ('order[0][dir]', 'asc'),
    ('start', '0'),
    ('length', '500'),
    ('search[value]', ''),
    ('search[regex]', 'false'),
    ('Username', ''),
    ('FirstName', ''),
    ('LastName', ''),
    ('Phone', ''),
    ('Email', ''),
    ('SearchStatus', ''),
    ('SortBy', ''),
    ('SortOrder', ''),
    ('IsNewSearch', 'false'),
    ('isRedirect', 'false'),
    ('locationContext', ''),
])

req = urllib.request.Request(
    'https://pod.planetaltig.com/account/getUserList?userstatus=&SearchByRole=&OfficeId=',
    data=params.encode(),
)
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

try:
    resp = opener.open(req)
    content = resp.read().decode('utf-8', errors='replace')
    print('Status:', resp.getcode(), 'Length:', len(content))
    # Try to parse as JSON
    try:
        data = json.loads(content)
        print('recordsTotal:', data.get('recordsTotal'))
        print('data count:', len(data.get('data', [])))
        if data.get('data'):
            print('First record keys:', list(data['data'][0].keys()) if isinstance(data['data'][0], dict) else data['data'][0][:5])
            print('First 3 records:', json.dumps(data['data'][:3], indent=2)[:500])
    except:
        print('Not JSON, first 500:', content[:500])
except Exception as e:
    print('Error:', e)
    # Try to read error body
    if hasattr(e, 'read'):
        print('Error body:', e.read().decode()[:200])
