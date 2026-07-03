import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re
import time

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

resp = opener.open('https://pod.planetaltig.com/AssociateDetails?u=michaelmandella')
content = resp.read().decode('utf-8', errors='replace')

# Show all table rows (th/td pairs)
rows = re.findall(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', content, re.DOTALL)
print('All table fields:')
for th, td in rows:
    th_clean = re.sub(r'<[^>]+>', '', th).strip()
    td_clean = re.sub(r'<[^>]+>', '', td).strip()
    if th_clean or td_clean:
        print(f'  {th_clean}: {td_clean[:80]}')
