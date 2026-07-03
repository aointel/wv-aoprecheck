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

# Show my AssociateDetails to understand the structure
resp = opener.open('https://pod.planetaltig.com/AssociateDetails?u=michaelmandella')
content = resp.read().decode('utf-8', errors='replace')

idx = content.find('Associate ID')
print('Associate ID section:')
print(content[idx:idx+300])

# Find my actual associate ID
assoc_section = content[idx:idx+300]
num = re.search(r'(\d{5,8})', assoc_section)
if num:
    print('\nMy Associate ID:', num.group(1))

# Now try to find how to lookup agents - look for the u= param handling
print('\n=== URL param handling ===')
idx2 = content.find('var u ')
if idx2 < 0: idx2 = content.find("'u'")
if idx2 < 0: idx2 = content.find('"u"')
if idx2 >= 0:
    print(content[idx2:idx2+200])
