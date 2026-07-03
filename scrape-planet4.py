import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

# Login
data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', data)
print('Logged in')

# Explore the homepage for search links
resp = opener.open('https://pod.planetaltig.com/')
content = resp.read().decode('utf-8', errors='replace')

# Find all links
links = re.findall(r'href="(/[^"]+)"', content)
print('Links on homepage:', links[:20])
print()

# Try different search endpoints
for url in [
    'https://pod.planetaltig.com/Agent/Search?q=Aaron+Lawrence',
    'https://pod.planetaltig.com/Agent?search=Aaron+Lawrence', 
    'https://pod.planetaltig.com/Search?q=Aaron+Lawrence',
    'https://pod.planetaltig.com/Directory?name=Aaron+Lawrence',
    'https://pod.planetaltig.com/Agent/Index?name=Aaron',
    'https://pod.planetaltig.com/api/agents?name=Aaron',
]:
    try:
        r = opener.open(url)
        c = r.read().decode('utf-8', errors='replace')
        print(f'{url}: {r.getcode()} len={len(c)} url={r.geturl()}')
        if len(c) > 100 and 'login' not in r.geturl().lower():
            print('  snippet:', c[:200])
    except Exception as e:
        print(f'{url}: ERROR {e}')
