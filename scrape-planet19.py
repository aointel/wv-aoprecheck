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

def try_fetch(status_val, search_status, location):
    params = urllib.parse.urlencode([
        ('draw', '1'),
        ('columns[0][data]', '0'), ('columns[0][searchable]', 'true'), ('columns[0][orderable]', 'false'), ('columns[0][search][value]', ''), ('columns[0][search][regex]', 'false'),
        ('columns[1][data]', '1'), ('columns[1][searchable]', 'true'), ('columns[1][orderable]', 'true'), ('columns[1][search][value]', ''), ('columns[1][search][regex]', 'false'),
        ('order[0][column]', '1'), ('order[0][dir]', 'asc'),
        ('start', '0'), ('length', '2000'),
        ('search[value]', ''), ('search[regex]', 'false'),
        ('Username', ''), ('FirstName', ''), ('LastName', ''), ('Phone', ''), ('Email', ''),
        ('SearchStatus', str(search_status)), ('SortBy', ''), ('SortOrder', ''),
        ('IsNewSearch', 'true'), ('isRedirect', 'false'), ('locationContext', location),
    ])
    req = urllib.request.Request(
        f'https://pod.planetaltig.com/account/getUserList?userstatus={status_val}&SearchByRole=0&OfficeId=',
        data=params.encode(),
    )
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
    req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')
    req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')
    try:
        resp = opener.open(req)
        data = json.loads(resp.read().decode('utf-8', errors='replace'))
        total = data.get('recordsTotal', 0)
        count = len(data.get('data', []))
        print(f'userstatus={status_val} SearchStatus={search_status} loc={location}: total={total} data={count}')
        if count > 0:
            print('First:', json.dumps(data['data'][0])[:200])
        return data
    except Exception as e:
        print(f'userstatus={status_val} SearchStatus={search_status} loc={location}: ERROR {e}')
        return None

for status in ['AllActive', 'Active', 'All']:
    for ss in [0, 1, '']:
        for loc in ['AO', 'NY', '']:
            r = try_fetch(status, ss, loc)
            if r and r.get('recordsTotal', 0) > 0:
                print('FOUND DATA! Stopping.')
                sys.exit(0)
