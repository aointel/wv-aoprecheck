import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Check common/scripts for what headers/tokens it sends with XHR
resp = opener.open('https://pod.planetaltig.com/common/scripts?v=2BDNJmnbg3aRp0e0_W5EfbuETd2F7HgQ62imnNha1A41')
common = resp.read().decode('utf-8', errors='replace')

# Look for beforeSend, headers, csrf patterns
for term in ['beforeSend', 'RequestVerification', 'X-Custom', 'ajaxSetup', 'headers:', 'Error11', 'errorCode']:
    idx = common.find(term)
    if idx >= 0:
        print(f'\n=== {term} ===')
        print(common[idx:idx+300])

# Also check the Report/LeadSearch for the JS that calls AutoComplete
resp2 = opener.open('https://pod.planetaltig.com/Report/LeadSearch')
ls = resp2.read().decode('utf-8', errors='replace')
idx = ls.find('AutoComplete')
if idx >= 0:
    print('\n=== AutoComplete JS ===')
    print(ls[idx:idx+400])

# Check for the token in the page
token = re.search(r'__RequestVerificationToken.*?value="([^"]+)"', ls)
if token:
    print('\nCSRF Token:', token.group(1)[:50])
