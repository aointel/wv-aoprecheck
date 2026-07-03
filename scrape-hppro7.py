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

# Look for HTTP calls (this might use $http or vue-resource)
for pattern in ['$http.get', '$http.post', 'axios', 'fetch(', 'XMLHttpRequest', 'getAssociate', 'searchAgent']:
    idx = app_js.find(pattern)
    if idx >= 0:
        print(f'\n{pattern}:')
        print(app_js[idx:idx+200])

# Find URL patterns with agent/associate names
assoc_patterns = re.findall(r'["\']([^"\']*(?:[Aa]ssociate|[Aa]gent)[^"\']{3,20})["\']', app_js)
print('\nAssociate/Agent patterns:')
for p in set(assoc_patterns)[:20]:
    print(' ', p)
