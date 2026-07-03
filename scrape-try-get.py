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
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')]

opener.open('https://pod.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

# Visit the LeadSearch page first (to set referrer context)
opener.open('https://pod.planetaltig.com/Report/LeadSearch')

# Try GET without XMLHttpRequest header - just like a browser nav
for term in ['Aaron', 'Darby', 'Smith']:
    url = f'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?showterminatedonly=false&officeID=0&contextID=1&searchByAgentNumber=false&searchByPhoneNumber=false&term={urllib.parse.quote(term)}'
    req = urllib.request.Request(url)
    req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')
    req.add_header('Referer', 'https://pod.planetaltig.com/Report/LeadSearch')
    # NO X-Requested-With header
    try:
        resp = opener.open(req)
        c = resp.read().decode('utf-8', errors='replace')
        print(f'term={term}: {resp.getcode()} len={len(c)}')
        print(c[:400])
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'term={term}: {e.code} {body[:100]}')
    time.sleep(0.3)
