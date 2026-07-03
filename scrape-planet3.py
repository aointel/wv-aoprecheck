import urllib.request
import urllib.parse
import http.cookiejar
import json
import re

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

# Login
data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
resp = opener.open('https://pod.planetaltig.com/Account/Login', data)
content = resp.read().decode('utf-8', errors='replace')
final_url = resp.geturl()
print('Final URL:', final_url)
print('Logged in:', 'logout' in content.lower() or 'sign out' in content.lower())
print('Cookies:', [(c.name, c.value[:20]) for c in cj])
print('Content snippet:', content[:300])
