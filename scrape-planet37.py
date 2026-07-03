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

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Test the autocomplete endpoint
for q in ['Aaron', 'Lawrence', 'Smith']:
    url = f'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?term={urllib.parse.quote(q)}'
    req = urllib.request.Request(url)
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Accept', 'application/json, text/javascript, */*')
    req.add_header('Referer', 'https://pod.planetaltig.com/Report/LeadSearch')
    try:
        resp = opener.open(req)
        content = resp.read().decode('utf-8', errors='replace')
        print(f'q={q}: {resp.getcode()} len={len(content)}')
        print(content[:400])
    except Exception as e:
        print(f'q={q}: {e}')
    time.sleep(0.3)
