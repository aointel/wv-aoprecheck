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

resp = opener.open('https://pod.planetaltig.com/Report/LeadSearch')
content = resp.read().decode('utf-8', errors='replace')

# Find office and context values
office = re.search(r"id=['\"]office['\"][^>]*value=['\"](\d*)['\"]", content)
context = re.search(r"id=['\"]changecontext['\"][^>]*value=['\"](\d*)['\"]", content)
print('office:', office.group(1) if office else 'not found')
print('context:', context.group(1) if context else 'not found')

# Find select options for office/context
for field in ['office', 'changecontext']:
    idx = content.find(f'id="{field}"')
    if idx >= 0:
        print(f'\n{field} HTML:')
        print(content[idx:idx+200])

# Try GET autocomplete with term
for term in ['Aaron', 'Smith', 'Jones']:
    url = f'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?showterminatedonly=false&officeID=0&contextID=0&searchByAgentNumber=false&searchByPhoneNumber=false&term={urllib.parse.quote(term)}'
    req = urllib.request.Request(url)
    req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Referer', 'https://pod.planetaltig.com/Report/LeadSearch')
    try:
        resp2 = opener.open(req)
        c = resp2.read().decode('utf-8', errors='replace')
        print(f'\nterm={term}: {resp2.getcode()} len={len(c)}')
        if len(c) < 5000:
            print(c[:500])
    except Exception as e:
        print(f'term={term}: {e}')
    time.sleep(0.2)
