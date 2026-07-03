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

opener.open('https://hppro.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

# Get the cookies after hppro login 
print('Cookies:')
for c in cj:
    print(f'  {c.name}={c.value[:30]} domain={c.domain}')

# Get app.js and look for search patterns differently
resp = opener.open('https://hppro.planetaltig.com/distold/js/app.e82a698b.js')
app_js = resp.read().decode('utf-8', errors='replace')

# Look for URLs in the JS - different pattern
urls = re.findall(r'"(/[A-Za-z][A-Za-z0-9/_-]{5,})"', app_js)
unique = sorted(set(urls))
print(f'\nFound {len(unique)} URL patterns')
# Filter to likely API endpoints
api = [u for u in unique if 'search' in u.lower() or 'agent' in u.lower() or 'user' in u.lower() or 'assoc' in u.lower()]
print('Agent/user/search URLs:')
for u in api[:20]:
    print(' ', u)
    
# Also look for any http calls
fetch_urls = re.findall(r'fetch\("([^"]+)"', app_js)
print('\nFetch URLs:', fetch_urls[:10])
axios_urls = re.findall(r'axios\.\w+\("([^"]+)"', app_js) 
print('Axios URLs:', axios_urls[:10])
