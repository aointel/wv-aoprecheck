import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [
    ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
    ('X-Requested-With', 'XMLHttpRequest'),
    ('Accept', 'application/json, text/javascript, */*; q=0.01'),
]

data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', data)

# Try the getUserList endpoint
resp = opener.open('https://pod.planetaltig.com/account/getUserList')
content = resp.read().decode('utf-8', errors='replace')
print('Status:', resp.getcode())
print('Length:', len(content))
print('First 500:', content[:500])
