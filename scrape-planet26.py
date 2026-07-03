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

# My user ID is 231 from the cookie: userid=231
# Try LoadUserBasicDetail with userId param
for params_dict in [
    {'userId': '231'},
    {'id': '231'},
    {'UserId': '231'},
]:
    data = urllib.parse.urlencode(params_dict).encode()
    req = urllib.request.Request('https://pod.planetaltig.com/Account/LoadUserBasicDetail', data=data)
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        resp = opener.open(req)
        content = resp.read().decode('utf-8', errors='replace')
        print(f'params={params_dict}: {resp.getcode()} {len(content)}')
        print(content[:300])
    except Exception as e:
        print(f'params={params_dict}: {e}')

# Also try Account/Edit?id=231 to see what format an agent profile looks like
resp = opener.open('https://pod.planetaltig.com/Account/Edit?id=231')
content = resp.read().decode('utf-8', errors='replace')
print('\nAccount/Edit?id=231:', resp.geturl(), len(content))
# Look for AssociateId in the form
assoc = re.search(r'[Aa]ssociate[^\d]*(\d{5,7})', content)
if assoc:
    print('My AssociateId:', assoc.group(1))
# Find all 5-7 digit numbers
numbers = re.findall(r'\b(\d{5,7})\b', content)
print('5-7 digit numbers on page:', list(set(numbers))[:10])
