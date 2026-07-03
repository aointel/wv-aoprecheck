import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', data)

resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Extract table rows - look for patterns with associate ID and name
# Try to find the data structure
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)
print(f'Found {len(rows)} rows')

# Find first few data rows
for row in rows[2:6]:
    cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
    cleaned = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
    print('Row:', cleaned[:6])
