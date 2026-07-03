import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Try the Report/LeadSearch which was in the nav - might have agent lookup
# Also try Account/Edit and Account/Profile endpoints
for url in [
    'https://pod.planetaltig.com/Account/GetOfficesSelectListData',
    'https://pod.planetaltig.com/Report/LeadSearch',
    'https://pod.planetaltig.com/api/account/search?name=Aaron',
    'https://pod.planetaltig.com/Account/Profile?alias=aaronlawrence',
]:
    try:
        resp = opener.open(url)
        content = resp.read().decode('utf-8', errors='replace')
        if resp.geturl() != 'https://pod.planetaltig.com/Account/Login':
            print(f'\n{url}: {resp.getcode()} len={len(content)}')
            if len(content) < 2100:
                print(content[:500])
            else:
                print(content[:200])
    except Exception as e:
        print(f'{url}: {e}')

# Try searching by name via the Report endpoint
print('\n--- Trying name search ---')
search_data = urllib.parse.urlencode({'name': 'Aaron Lawrence', 'type': 'agent'}).encode()
for endpoint in [
    'https://pod.planetaltig.com/Account/SearchAgent',
    'https://pod.planetaltig.com/Account/FindAgent',
    'https://pod.planetaltig.com/api/Agent/Search',
    'https://pod.planetaltig.com/Agent/GetByName',
]:
    try:
        req = urllib.request.Request(endpoint, data=search_data)
        req.add_header('X-Requested-With', 'XMLHttpRequest')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        resp = opener.open(req)
        content = resp.read().decode('utf-8', errors='replace')
        print(f'{endpoint}: {resp.getcode()} len={len(content)} url={resp.geturl()}')
        if content and len(content) < 5000 and 'login' not in resp.geturl().lower():
            print(content[:300])
    except Exception as e:
        print(f'{endpoint}: {e}')
