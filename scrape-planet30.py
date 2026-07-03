import urllib.request
import urllib.parse
import http.cookiejar
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Try fetching page for aaronglawrence
resp = opener.open('https://pod.planetaltig.com/Account/Edit?alias=aaronglawrence')
content = resp.read().decode('utf-8', errors='replace')
print('URL:', resp.geturl())
print('Length:', len(content))

# Search for associate id, name, email fields
for field in ['AssociateId', 'associate', 'Email', 'FirstName', 'LastName', 'aoglobelife']:
    idx = content.find(field)
    if idx >= 0:
        print(f'\n=== {field} ===')
        print(content[idx:idx+150])
