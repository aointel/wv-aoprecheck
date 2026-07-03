import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

opener.open('https://pod.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

# Check Account/List page for the agencyId and context
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Find agencyId, agency, organization context
for term in ['agencyId', 'AgencyId', 'agencyid', 'OrganizationId', 'organizationId', 'contextID', 'ContextId']:
    idx = content.find(term)
    if idx >= 0:
        print(f'{term}:', content[idx:idx+150])

# Look for hidden inputs that set context
hidden = re.findall(r'<input[^>]+hidden[^>]*value="([^"]*)"[^>]*id="([^"]*)"', content)
print('\nHidden inputs with values:', [(v[:30], id_) for v, id_ in hidden if v])

# Try the getUserList with specific agencyId in the URL
params = urllib.parse.urlencode([
    ('draw', '1'),
    ('start', '0'), ('length', '500'),
    ('search[value]', ''), ('search[regex]', 'false'),
    ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
    ('Username', ''), ('FirstName', ''), ('LastName', ''), ('Phone', ''), ('Email', ''),
    ('SearchStatus', '1'), ('SortBy', ''), ('SortOrder', ''),
    ('IsNewSearch', 'true'), ('isRedirect', 'false'), ('locationContext', 'AO'),
    ('IsAdministrator', 'true'), ('IsSearchBarAccess', 'true'),
    ('OfficeId', '151'),  # AIL PNW
])

req = urllib.request.Request(
    'https://pod.planetaltig.com/account/getUserList?userstatus=AllActive&SearchByRole=0&OfficeId=151',
    data=params.encode(),
)
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')

try:
    r = opener.open(req)
    data = json.loads(r.read().decode('utf-8', errors='replace'))
    print(f'\nOfficeId=151: total={data.get("recordsTotal")} count={len(data.get("data",[]))}')
    if data.get('data'):
        print('First:', json.dumps(data['data'][0])[:200])
except Exception as e:
    print(f'OfficeId=151: {e}')
