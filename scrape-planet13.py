import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Look at the full JS for initial status values and defaults
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Find currentStatus initialization
for pattern in ['currentStatus', 'userstatus', 'UserStatus', 'defaultStatus', 'SearchByRole']:
    idx = content.find(pattern)
    if idx >= 0:
        print(f'\n=== {pattern} ===')
        print(content[max(0,idx-100):idx+200])
