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

def search_agents(last_name='', first_name='', search_by=3):
    """search_by: 1=username, 2=firstname, 3=lastname, 4=phone, 5=email"""
    if search_by == 2:
        search_text = first_name
    elif search_by == 3:
        search_text = last_name
    else:
        search_text = first_name or last_name

    # Build the exact params the DataTable sends
    params = [
        ('draw', '1'),
    ]
    # Add columns (at minimum a few)
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
        ('order[0][column]', '1'),
        ('order[0][dir]', 'asc'),
        ('start', '0'),
        ('length', '100'),
        ('search[value]', ''),
        ('search[regex]', 'false'),
        # Custom params added by the data function
        ('Username', first_name if search_by == 1 else ''),
        ('FirstName', first_name if search_by == 2 else ''),
        ('LastName', last_name if search_by == 3 else ''),
        ('Phone', ''),
        ('Email', ''),
        ('SearchStatus', str(search_by)),
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
        f'https://pod.planetaltig.com/account/getUserList?userstatus=AllActive&SearchByRole=0&OfficeId=',
        data=urllib.parse.urlencode(params).encode(),
    )
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
    req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
    req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')

    try:
        resp = opener.open(req)
        data = json.loads(resp.read().decode('utf-8', errors='replace'))
        return data.get('data', []), data.get('recordsTotal', 0)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return None, f'ERROR {e.code}: {body[:50]}'

# Test
results, total = search_agents(last_name='Lawrence', search_by=3)
print(f'Lawrence: total={total} results={len(results) if results else 0}')
if results:
    print('First:', json.dumps(results[0])[:300])
else:
    print('Error:', total)
