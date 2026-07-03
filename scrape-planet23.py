import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Include IsAdministrator and IsSearchBarAccess in the POST
params = urllib.parse.urlencode([
    ('draw', '1'),
    ('columns[0][data]', '0'), ('columns[0][name]', ''), ('columns[0][searchable]', 'true'),
    ('columns[0][orderable]', 'false'), ('columns[0][search][value]', ''), ('columns[0][search][regex]', 'false'),
    ('columns[1][data]', '1'), ('columns[1][name]', ''), ('columns[1][searchable]', 'true'),
    ('columns[1][orderable]', 'true'), ('columns[1][search][value]', ''), ('columns[1][search][regex]', 'false'),
    ('columns[2][data]', '2'), ('columns[2][name]', ''), ('columns[2][searchable]', 'true'),
    ('columns[2][orderable]', 'true'), ('columns[2][search][value]', ''), ('columns[2][search][regex]', 'false'),
    ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
    ('start', '0'), ('length', '2000'),
    ('search[value]', ''), ('search[regex]', 'false'),
    ('Username', ''), ('FirstName', ''), ('LastName', ''), ('Phone', ''), ('Email', ''),
    ('SearchStatus', '1'), ('SortBy', ''), ('SortOrder', ''),
    ('IsNewSearch', 'true'), ('isRedirect', 'false'), ('locationContext', 'AO'),
    ('IsAdministrator', 'true'), ('IsSearchBarAccess', 'true'),
    ('OfficeId', ''), ('ManagerId', ''),
])

req = urllib.request.Request(
    'https://pod.planetaltig.com/account/getUserList?userstatus=AllActive&SearchByRole=0&OfficeId=',
    data=params.encode(),
)
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')

try:
    resp = opener.open(req)
    content = resp.read().decode('utf-8', errors='replace')
    data = json.loads(content)
    total = data.get('recordsTotal', 0)
    count = len(data.get('data', []))
    print(f'recordsTotal={total}, data count={count}')
    if count > 0:
        print('Keys:', list(data['data'][0].keys()) if isinstance(data['data'][0], dict) else 'list')
        print('First 3:', json.dumps(data['data'][:3], indent=2)[:600])
except Exception as e:
    print('Error:', e)
    if hasattr(e, 'read'):
        body = e.read().decode('utf-8', errors='replace')
        print('Error body:', body[:300])
