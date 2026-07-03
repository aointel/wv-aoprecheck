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

resp = opener.open('https://pod.planetaltig.com/Scripts/Custom/Report/LeadSearch.js')
content = resp.read().decode('utf-8', errors='replace')
print('LeadSearch.js length:', len(content))

# Look for error handling / CSRF
for term in ['Error11', 'errorCode', 'beforeSend', 'headers', 'RequestVerification', 'AutoComplete', 'ajax']:
    idx = content.find(term)
    if idx >= 0:
        print(f'\n=== {term} ===')
        print(content[idx:idx+300])
