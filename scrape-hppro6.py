import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

opener.open('https://hppro.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

resp = opener.open('https://hppro.planetaltig.com/distold/js/app.e82a698b.js')
app_js = resp.read().decode('utf-8', errors='replace')

# Search for /api/ patterns
api_patterns = re.findall(r'/api/[A-Za-z0-9/._-]+', app_js)
unique_api = sorted(set(api_patterns))
print('All /api/ patterns:')
for p in unique_api[:40]:
    print(' ', p)
    
# Search for baseURL
base_url = re.findall(r'baseURL["\s:]+["\']([^"\']+)["\']', app_js)
print('\nbaseURL:', base_url[:5])
