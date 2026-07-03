import urllib.request
import urllib.parse
import http.cookiejar
import re
import json

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

# Login
login_page = opener.open('https://pod.planetaltig.com/Account/Login').read().decode()
token_m = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', login_page)
token = token_m.group(1) if token_m else ''
print('CSRF token:', bool(token))

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!', '__RequestVerificationToken': token}).encode()
resp = opener.open('https://pod.planetaltig.com/Account/Login', login_data)
print('After login URL:', resp.geturl())

# Get report page to get a fresh CSRF token
report_page = opener.open('https://pod.planetaltig.com/Report/LeadSearch').read().decode()
token2_m = re.search(r'__RequestVerificationToken.*?value="([^"]+)"', report_page)
print('Got report CSRF token:', bool(token2_m))

# Try autocomplete
for term in ['Lawrence', 'Blanding', 'Stander']:
    url = f'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?term={urllib.parse.quote(term)}&showterminatedonly=false'
    req = urllib.request.Request(url)
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Accept', 'application/json, text/javascript, */*')
    req.add_header('Referer', 'https://pod.planetaltig.com/Report/LeadSearch')
    if token2_m:
        req.add_header('RequestVerificationToken', token2_m.group(1))
    try:
        resp = opener.open(req)
        result = resp.read().decode('utf-8', errors='replace')
        print(f'\nterm={term}: code={resp.getcode()} len={len(result)}')
        print(result[:300])
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'\nterm={term}: HTTP {e.code}: {body[:200]}')
