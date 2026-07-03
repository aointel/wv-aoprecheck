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

# Check Report/LeadSearch page for agent-related JS
resp = opener.open('https://pod.planetaltig.com/Report/LeadSearch')
content = resp.read().decode('utf-8', errors='replace')

# Find all AJAX endpoints 
all_urls = re.findall(r"""(?:url|URL)\s*[:=]\s*['"]([^'"]+)['"]""", content)
print('All URL= patterns:', all_urls[:20])

# Find the agent hierarchy autocomplete params
idx = content.find('AutoCompleteAssociateHierarchy')
if idx >= 0:
    print('\nAutocomplete context:')
    print(content[max(0,idx-200):idx+500])
