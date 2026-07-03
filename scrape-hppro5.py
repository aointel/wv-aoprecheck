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

opener.open('https://hppro.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

# The app uses REST API - try common REST patterns for agent search
for url in [
    'https://hppro.planetaltig.com/api/associates?name=Aaron',
    'https://hppro.planetaltig.com/api/associates/search?q=Aaron',
    'https://hppro.planetaltig.com/api/Agent/Search?name=Aaron',
    'https://hppro.planetaltig.com/api/v1/agents?search=Aaron',
    'https://hppro.planetaltig.com/api/users?name=Aaron',
    'https://hppro.planetaltig.com/associates?name=Aaron',
    'https://hppro.planetaltig.com/api/associate/getbyname?name=Aaron',
    'https://hppro.planetaltig.com/Home/AutoCompleteAssociateHierarchy?term=Aaron&showterminatedonly=false&officeID=0&contextID=1',
]:
    try:
        req = urllib.request.Request(url)
        req.add_header('Accept', 'application/json')
        req.add_header('X-Requested-With', 'XMLHttpRequest')
        r = opener.open(req)
        c = r.read().decode('utf-8', errors='replace')
        final = r.geturl()
        print(f'{url.split("/")[-1]}: {r.getcode()} len={len(c)} url={final.split("/")[-1]}')
        if len(c) < 3000 and 'login' not in final.lower():
            print('  Content:', c[:200])
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'{url.split("/")[-1]}: HTTP {e.code} {body[:50]}')
    except Exception as e:
        print(f'{url.split("/")[-1]}: {type(e).__name__}')
    time.sleep(0.2)
