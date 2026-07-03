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
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

# Try hppro login
data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
resp = opener.open('https://hppro.planetaltig.com/Account/Login', data)
print('hppro login URL:', resp.geturl())
content = resp.read().decode('utf-8', errors='replace')
print('Logged into hppro:', 'logout' in content.lower() or 'sign out' in content.lower())

# Try agent search on hppro
for term in ['Aaron Lawrence', 'Darby']:
    url = f'https://hppro.planetaltig.com/Home/AutoCompleteAssociateHierarchy?term={urllib.parse.quote(term)}&showterminatedonly=false&officeID=0&contextID=1&searchByAgentNumber=false&searchByPhoneNumber=false'
    req = urllib.request.Request(url)
    req.add_header('Accept', 'application/json, */*')
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    try:
        r = opener.open(req)
        c = r.read().decode('utf-8', errors='replace')
        print(f'hppro term={term}: {r.getcode()} {c[:400]}')
    except Exception as e:
        print(f'hppro term={term}: {e}')
    time.sleep(0.3)
