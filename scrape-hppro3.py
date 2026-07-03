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

# Get the Vue app JS to find API endpoints
resp = opener.open('https://hppro.planetaltig.com/distold/js/app.e82a698b.js')
app_js = resp.read().decode('utf-8', errors='replace')
print('app.js length:', len(app_js))

# Find API endpoints
api_paths = re.findall(r'["\']([/]api[/][^"\'<>\s]{3,})["\']', app_js)
print('\nAPI endpoints:', sorted(set(api_paths))[:30])

# Also look for agent search
agent_search = re.findall(r'["\']([^"\']*agent[^"\']*search[^"\']*)["\']', app_js, re.IGNORECASE)
print('\nAgent search endpoints:', agent_search[:10])
