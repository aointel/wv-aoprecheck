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

# The list page is 152KB - look for embedded user data
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Look for Edit links with IDs
edit_links = re.findall(r'/Account/Edit\?id=(\d+)', content)
print(f'Edit links found: {len(edit_links)}')
print('Sample IDs:', edit_links[:10])

# Look for any JSON data embedded
json_data = re.findall(r'var\s+\w+\s*=\s*(\[{.*?}\])', content, re.DOTALL)
print(f'\nJSON arrays found: {len(json_data)}')
for j in json_data[:2]:
    print(j[:200])
