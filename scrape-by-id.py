import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
opener.open('https://pod.planetaltig.com/Account/Login', 
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

# Try numeric IDs
for uid in [232, 233, 234, 235, 240, 250, 300, 500, 1000]:
    try:
        resp = opener.open(f'https://pod.planetaltig.com/AssociateDetails?u={uid}')
        content = resp.read().decode('utf-8', errors='replace')
        rows = re.findall(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', content, re.DOTALL)
        data = {re.sub(r'<[^>]+>', '', th).strip(): re.sub(r'<[^>]+>', '', td).strip() for th, td in rows}
        name = data.get('Name', 'N/A')
        assoc = data.get('Associate ID', 'N/A')
        email = data.get('Company Email', 'N/A')
        print(f'uid={uid}: {name} | id={assoc} | {email}')
    except Exception as e:
        print(f'uid={uid}: {e}')
    time.sleep(0.1)
