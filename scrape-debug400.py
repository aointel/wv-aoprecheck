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

# List all cookies
print('Cookies after login:')
for c in cj:
    print(f'  {c.name}={c.value[:30]} domain={c.domain}')

# Try the autocomplete with a GET request (not POST) to see actual error body
url = 'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?showterminatedonly=false&officeID=0&contextID=1&searchByAgentNumber=false&searchByPhoneNumber=false&term=Aaron'
req = urllib.request.Request(url)
req.add_header('Accept', 'application/json, text/javascript, */*; q=0.01')
req.add_header('X-Requested-With', 'XMLHttpRequest')
req.add_header('Referer', 'https://pod.planetaltig.com/Report/LeadSearch')

try:
    resp = opener.open(req)
    print('Success:', resp.read().decode()[:300])
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {e.reason}')
    print('Error body:', body[:300])
    print('Error headers:', dict(e.headers))
