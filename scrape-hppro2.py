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
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

resp = opener.open('https://hppro.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())
content = resp.read().decode('utf-8', errors='replace')
print('URL:', resp.geturl())
# Find nav links
links = re.findall(r'href="(/[^"]+)"', content)
print('Links:', links[:15])

# Try some endpoints
for url in [
    'https://hppro.planetaltig.com/Agent/Search?name=Aaron',
    'https://hppro.planetaltig.com/api/agents?term=Aaron',
    'https://hppro.planetaltig.com/Agent/List',
    'https://hppro.planetaltig.com/Report/AgentList',
]:
    try:
        r = opener.open(url)
        c = r.read().decode('utf-8', errors='replace')
        final = r.geturl()
        if 'login' not in final.lower():
            print(f'\n{url}: {r.getcode()} len={len(c)} url={final}')
            print(c[:200])
    except Exception as e:
        print(f'{url}: {e}')
