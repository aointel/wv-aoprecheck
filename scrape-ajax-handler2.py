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
list_content = resp.read().decode('utf-8', errors='replace')

# Find AjaxGlobalHandler in the inline script
idx = list_content.find('AjaxGlobalHandler')
if idx >= 0:
    print('Found in page:')
    print(list_content[idx:idx+300])

# It must be defined somewhere - check if it's in a script tag inline
scripts_inline = re.findall(r'<script(?! src)[^>]*>(.*?)</script>', list_content, re.DOTALL)
print(f'\nInline scripts: {len(scripts_inline)}')
for i, s in enumerate(scripts_inline):
    if 'AjaxGlobalHandler' in s or 'ajax' in s.lower():
        print(f'\nScript {i}: (len={len(s)})')
        print(s[:500])
