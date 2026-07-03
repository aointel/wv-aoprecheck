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

# My Account/Edit page has user IDs in it - look for the pattern of other agents
resp = opener.open('https://pod.planetaltig.com/Account/Edit?id=231')
content = resp.read().decode('utf-8', errors='replace')

# Find the AssociateId field name in the form
idx = content.find('21812')
print('Context around my AssociateId 21812:')
print(content[max(0,idx-200):idx+200])
print()

# Find the form fields related to associate ID
assoc_field = re.search(r'name="([^"]*[Aa]ssociate[^"]*)"', content)
if assoc_field:
    print('AssociateId field name:', assoc_field.group(1))

# Look for the structure that has the associate ID
# Let's see all input fields
inputs = re.findall(r'<input[^>]*>', content)
for inp in inputs:
    if '21812' in inp or 'ssociate' in inp.lower():
        print('Field:', inp[:150])
