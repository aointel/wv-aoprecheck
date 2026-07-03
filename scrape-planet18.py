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

list_resp = opener.open('https://pod.planetaltig.com/Account/List')
list_content = list_resp.read().decode('utf-8', errors='replace')

# Find SearchBy select options
idx = list_content.find('id="SearchBy"')
print('SearchBy options:')
print(list_content[idx:idx+300])

# Try with all the right params including locationContext=AO
params = urllib.parse.urlencode([
    ('draw', '1'),
    ('columns[0][data]', '0'), ('columns[0][name]', ''), ('columns[0][searchable]', 'true'),
    ('columns[0][orderable]', 'false'), ('columns[0][search][value]', ''), ('columns[0][search][regex]', 'false'),
    ('columns[1][data]', '1'), ('columns[1][name]', ''), ('columns[1][searchable]', 'true'),
    ('columns[1][orderable]', 'true'), ('columns[1][search][value]', ''), ('columns[1][search][regex]', 'false'),
    ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
    ('start', '0'), ('length', '500'),
    ('search[value]', ''), ('search[regex]', 'false'),
    ('Username', ''), ('FirstName', ''), ('LastName', ''), ('Phone', ''), ('Email', ''),
    ('SearchStatus', ''), ('SortBy', ''), ('SortOrder', 'null'),
    ('IsNewSearch', 'true'), ('isRedirect', 'false'), ('locationContext', 'AO'),
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
    print(f'\nrecordsTotal: {data.get("recordsTotal")}, data count: {len(data.get("data", []))}')
    if data.get('data'):
        print('First record:', json.dumps(data['data'][0])[:300])
except Exception as e:
    print('Error:', e)
    if hasattr(e, 'read'):
        body = e.read().decode('utf-8', errors='replace')
        print('Error body:', body[:300])
