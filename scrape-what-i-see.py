import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re
import time

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
opener.open('https://pod.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

# Search by first name 'A' - should return anyone starting with A that I can see
params = [
    ('draw', '1'),
]
for col_idx in range(8):
    params += [
        (f'columns[{col_idx}][data]', str(col_idx)),
        (f'columns[{col_idx}][name]', ''),
        (f'columns[{col_idx}][searchable]', 'true'),
        (f'columns[{col_idx}][orderable]', 'true' if col_idx > 0 else 'false'),
        (f'columns[{col_idx}][search][value]', ''),
        (f'columns[{col_idx}][search][regex]', 'false'),
    ]
params += [
    ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
    ('start', '0'), ('length', '500'),
    ('search[value]', ''), ('search[regex]', 'false'),
    ('Username', ''), ('FirstName', 'A'), ('LastName', ''), ('Phone', ''), ('Email', ''),
    ('SearchStatus', '2'),  # firstname
    ('SortBy', ''), ('SortOrder', ''),
    ('IsNewSearch', 'true'), ('isRedirect', 'false'), ('locationContext', 'AO'),
    ('IsAdministrator', 'true'), ('IsSearchBarAccess', 'true'),
    ('OfficeId', ''), ('ManagerId', ''),
]

req = urllib.request.Request(
    'https://pod.planetaltig.com/account/getUserList?userstatus=AllActive&SearchByRole=0&OfficeId=',
    data=urllib.parse.urlencode(params).encode(),
)
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')

try:
    resp = opener.open(req)
    data = json.loads(resp.read().decode('utf-8', errors='replace'))
    total = data.get('recordsTotal', 0)
    results = data.get('data', [])
    print(f'First name starts with A: total={total} returned={len(results)}')
    if results:
        print('Sample record keys:', list(results[0].keys()) if isinstance(results[0], dict) else 'list')
        print('First 3:')
        for r in results[:3]:
            print(' ', json.dumps(r)[:200])
except urllib.error.HTTPError as e:
    print(f'Error {e.code}:', e.read().decode()[:200])
