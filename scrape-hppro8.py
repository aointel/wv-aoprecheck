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

# Find all URL-like strings in the JS
url_patterns = re.findall(r'"((?:https?://|/)[A-Za-z0-9/_.-]{10,})"', app_js)
unique = sorted(set(url_patterns))
print(f'URL patterns ({len(unique)}):')
for u in unique[:50]:
    print(' ', u)
