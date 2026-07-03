import urllib.request
import urllib.parse
import http.cookiejar
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Get common/scripts - this likely has the main JS with search
resp = opener.open('https://pod.planetaltig.com/common/scripts?v=2BDNJmnbg3aRp0e0_W5EfbuETd2F7HgQ62imnNha1A41')
common = resp.read().decode('utf-8', errors='replace')
print('common/scripts length:', len(common))

# Find all URL endpoints
all_endpoints = re.findall(r'["\']([/][A-Za-z][A-Za-z/]+)["\']', common)
unique_endpoints = sorted(set(e for e in all_endpoints if len(e) > 5 and '.' not in e.split('/')[-1]))
print('\nAll endpoints in common/scripts:')
for ep in unique_endpoints[:30]:
    print(' ', ep)

# Look for search-related
search_eps = [e for e in unique_endpoints if 'search' in e.lower() or 'agent' in e.lower() or 'user' in e.lower()]
print('\nSearch/agent/user endpoints:')
for ep in search_eps:
    print(' ', ep)
