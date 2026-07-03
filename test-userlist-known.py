import urllib.request, urllib.parse, http.cookiejar, json, re

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
opener.open('https://pod.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

def userlist(last_name='', first_name=''):
    params = []
    for col_idx in range(8):
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
        ('length', '25'),
        ('search[value]', ''),
        ('search[regex]', 'false'),
        ('Username', ''),
        ('FirstName', first_name),
        ('LastName', last_name),
        ('Phone', ''),
        ('Email', ''),
        ('SearchStatus', '3' if last_name else '2'),
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
    resp = opener.open(req)
    return json.loads(resp.read().decode('utf-8', errors='replace'))

# Test with known agents
for last, first in [('Tran', 'Leyna'), ('Mandella', 'Michael'), ('Blash', 'Dianka'), ('Smith', ''), ('Johnson', '')]:
    result = userlist(last, first)
    total = result.get('recordsTotal', 0)
    rows = result.get('data', [])
    print(f'{first} {last}: total={total}, rows={len(rows)}')
    if rows:
        print(f'  First: {json.dumps(rows[0])[:300]}')
