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

# Try to access agent profile pages directly by email alias
# Emails are likely firstnamelastname@aoglobelife.com format - same as company email
# Try Account/Edit?id=X or Account/Profile?id=X or by alias

# Try LoadUserBasicDetail with a name search
data = urllib.parse.urlencode({'searchText': 'Aaron Lawrence', 'searchType': '1'}).encode()
req = urllib.request.Request('https://pod.planetaltig.com/Account/LoadUserBasicDetail', data=data)
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
req.add_header('Referer', 'https://pod.planetaltig.com/Account/List')

try:
    resp = opener.open(req)
    content = resp.read().decode('utf-8', errors='replace')
    print('LoadUserBasicDetail:', resp.getcode(), len(content))
    print(content[:500])
except Exception as e:
    print('LoadUserBasicDetail error:', e)

# Try Account/Edit GET with name
for url in [
    'https://pod.planetaltig.com/Account/Edit?alias=aaronlawrence',
    'https://pod.planetaltig.com/Account/View?alias=aaronlawrence',
    'https://pod.planetaltig.com/Account/Details?alias=aaronglawrence',
    'https://pod.planetaltig.com/Account/Profile?name=Aaron+Lawrence',
]:
    try:
        resp = opener.open(url)
        content = resp.read().decode('utf-8', errors='replace')
        final = resp.geturl()
        if 'login' not in final.lower() and 'error' not in final.lower():
            print(f'\n{url}: {resp.getcode()} {len(content)}')
            # Look for associate ID
            assoc = re.search(r'[Aa]ssociate[_\s]?[Ii][Dd]["\s:=]+(\d+)', content)
            if assoc:
                print('AssociateId:', assoc.group(1))
    except Exception as e:
        pass  # skip 404s
