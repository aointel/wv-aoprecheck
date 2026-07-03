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

# The autocomplete goes to /AssociateDetails?u= — so let's search and follow to AssociateDetails
# The autocomplete endpoint returns data for typeahead, try GET
for q in ['Aaron', 'Lawrence']:
    url = f'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?term={urllib.parse.quote(q)}&showterminatedonly=false'
    req = urllib.request.Request(url)
    req.add_header('Accept', 'application/json, text/javascript, */*')
    req.add_header('Referer', 'https://pod.planetaltig.com/Report/LeadSearch')
    try:
        resp = opener.open(req)
        content = resp.read().decode('utf-8', errors='replace')
        print(f'q={q}: {resp.getcode()} len={len(content)}')
        if len(content) < 5000:
            print(content[:500])
    except Exception as e:
        print(f'q={q}: {e}')
    time.sleep(0.3)

# Also try /AssociateDetails directly
resp2 = opener.open('https://pod.planetaltig.com/AssociateDetails?u=aaronglawrence')
content2 = resp2.read().decode('utf-8', errors='replace')
print('\n/AssociateDetails:', resp2.geturl(), len(content2))
if 'login' not in resp2.geturl().lower():
    # Look for associate id
    assoc = re.search(r'[Aa]ssociate[^\d]*(\d{5,7})', content2)
    if assoc:
        print('AssociateId:', assoc.group(1))
    else:
        print('No assoc ID, snippet:', content2[:300])
