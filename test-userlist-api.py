import urllib.request
import urllib.parse
import http.cookiejar
import re
import json

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Get Account/List page to check variables (currentStatus, locationContext, etc.)
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Find currentStatus and locationContext
for var in ['currentStatus', 'locationContext', 'SearchByRole', 'IsAdministrator']:
    m = re.search(rf'var\s+{var}\s*=\s*["\']?([^;"\'\n]+)', content)
    if m:
        print(f'{var}: {m.group(1)[:80]}')

# Look for what searchBy defaults to  
m2 = re.search(r'searchBy\s*=\s*(\d+)', content)
print('Default searchBy:', m2.group(1) if m2 else 'not found')

print('\n=== Trying getUserList with LastName=Lawrence ===')

# Build minimal params that match what DataTable sends
params = []
# DataTable columns (just a few)
for col_idx in range(6):
    params += [
        (f'columns[{col_idx}][data]', str(col_idx)),
        (f'columns[{col_idx}][name]', ''),
        (f'columns[{col_idx}][searchable]', 'true'),
        (f'columns[{col_idx}][orderable]', 'true'),
        (f'columns[{col_idx}][search][value]', ''),
        (f'columns[{col_idx}][search][regex]', 'false'),
    ]
params += [
    ('draw', '1'),
    ('order[0][column]', '1'),
    ('order[0][dir]', 'asc'),
    ('start', '0'),
    ('length', '50'),
    ('search[value]', ''),
    ('search[regex]', 'false'),
    # Custom search params
    ('Username', ''),
    ('FirstName', ''),
    ('LastName', 'Lawrence'),
    ('Phone', ''),
    ('Email', ''),
    ('SearchStatus', '3'),  # 3 = by last name
    ('SortBy', ''),
    ('SortOrder', ''),
    ('IsNewSearch', 'true'),
    ('isRedirect', 'false'),
    ('locationContext', 'AO'),
    ('IsAdministrator', 'true'),
    ('IsSearchBarAccess', 'true'),
    ('OfficeId', ''),
    ('ManagerId', ''),
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
    resp2 = opener.open(req)
    result = json.loads(resp2.read().decode('utf-8', errors='replace'))
    print(f'Status: {resp2.getcode()}')
    print(f'recordsTotal: {result.get("recordsTotal")}')
    print(f'data count: {len(result.get("data", []))}')
    if result.get('data'):
        print('First result:', json.dumps(result['data'][0])[:400])
    else:
        print('Full response:', json.dumps(result)[:500])
except Exception as e:
    print(f'Error: {e}')
