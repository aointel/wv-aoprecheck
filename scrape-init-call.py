import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
opener.open('https://pod.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Find the document.ready or init call
idx = content.find('$(document).ready')
if idx >= 0:
    print('$(document).ready context:')
    print(content[idx:idx+800])
    
# Find reloadDatable initial call
idx2 = content.find('reloadDatable(')
print('\nAll reloadDatable calls:')
while idx2 >= 0:
    print(content[idx2:idx2+50])
    idx2 = content.find('reloadDatable(', idx2+1)
    
# Find the AccountList specific JS
idx3 = content.find('/Scripts/Custom/Account')
if idx3 >= 0:
    print('\nCustom scripts:')
    print(content[idx3:idx3+100])
    
# List all script tags
scripts = re.findall(r'<script[^>]+src="([^"]+)"', content)
print('\nAll scripts:')
for s in scripts:
    print(' ', s)
