import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

params = urllib.parse.urlencode([
    ('draw', '1'),
    ('columns[0][data]', '0'), ('columns[0][searchable]', 'true'), ('columns[0][orderable]', 'false'), ('columns[0][search][value]', ''),
    ('columns[1][data]', '1'), ('columns[1][searchable]', 'true'), ('columns[1][orderable]', 'true'), ('columns[1][search][value]', ''),
    ('columns[2][data]', '2'), ('columns[2][searchable]', 'true'), ('columns[2][orderable]', 'true'), ('columns[2][search][value]', ''),
    ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
    ('start', '0'), ('length', '2000'),
    ('search[value]', ''), ('search[regex]', 'false'),
    ('Username', ''), ('FirstName', ''), ('LastName', ''), ('Phone', ''), ('Email', ''),
    ('SearchStatus', ''), ('SortBy', ''), ('SortOrder', ''),
    ('IsNewSearch', 'true'), ('isRedirect', 'false'), ('locationContext', ''),
])

req = urllib.request.Request(
    'https://pod.planetaltig.com/account/getUserList?userstatus=AllActive&SearchByRole=0&OfficeId=',
    data=params.encode(),
)
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
req.add_header('User-Agent', 'Mozilla/5.0')

resp = opener.open(req)
content = resp.read().decode('utf-8', errors='replace')
data = json.loads(content)
print('recordsTotal:', data.get('recordsTotal'))
print('data count:', len(data.get('data', [])))
if data.get('data') and len(data['data']) > 0:
    first = data['data'][0]
    print('First record type:', type(first))
    if isinstance(first, list):
        print('First record (list):', first[:8])
    elif isinstance(first, dict):
        print('First record keys:', list(first.keys()))
        print('First record:', json.dumps(first, indent=2)[:400])
