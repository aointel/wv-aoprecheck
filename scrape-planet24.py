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

def fetch(last_name='', first_name='', search_status=3):
    params = urllib.parse.urlencode([
        ('draw', '1'),
        ('columns[0][data]', '0'), ('columns[0][searchable]', 'true'), ('columns[0][orderable]', 'false'), ('columns[0][search][value]', ''), ('columns[0][search][regex]', 'false'),
        ('columns[1][data]', '1'), ('columns[1][searchable]', 'true'), ('columns[1][orderable]', 'true'), ('columns[1][search][value]', ''), ('columns[1][search][regex]', 'false'),
        ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
        ('start', '0'), ('length', '500'),
        ('search[value]', ''), ('search[regex]', 'false'),
        ('Username', ''), ('FirstName', first_name), ('LastName', last_name), ('Phone', ''), ('Email', ''),
        ('SearchStatus', str(search_status)), ('SortBy', ''), ('SortOrder', ''),
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
    resp = opener.open(req)
    return json.loads(resp.read().decode('utf-8', errors='replace'))

# Try: SearchStatus=3 (Last Name) with actual last name
for lname in ['Lawrence', 'Smith', 'Jones']:
    r = fetch(last_name=lname, search_status=3)
    print(f'lastName={lname}: total={r.get("recordsTotal")} count={len(r.get("data",[]))}')
    if r.get('data'):
        print('Sample:', json.dumps(r['data'][0])[:200])

# Try: SearchStatus=2 (First Name)
r = fetch(first_name='Aaron', search_status=2)
print(f'\nfirstName=Aaron SS=2: total={r.get("recordsTotal")} count={len(r.get("data",[]))}')
if r.get('data'):
    print('Sample:', json.dumps(r['data'][0])[:200])

# Try: no search text, SS=0 (select search by = no filter?)
for ss in range(0, 6):
    r = fetch(search_status=ss)
    print(f'SS={ss} no text: total={r.get("recordsTotal")} count={len(r.get("data",[]))}')
    if r.get('data'):
        print('FOUND! Sample:', json.dumps(r['data'][0])[:200])
        break
