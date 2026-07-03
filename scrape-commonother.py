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

# scriptsOther likely has the AJAX setup/CSRF
resp = opener.open('https://pod.planetaltig.com/common/scriptsOther?v=g_u6o9Eb4Wlq-sF9CsMZgyMaUVIKE_elgv8bkhAtYrE1')
content = resp.read().decode('utf-8', errors='replace')
print('scriptsOther length:', len(content))

# Find beforeSend, CSRF token setup, Error11
for term in ['beforeSend', 'RequestVerification', 'Error11', 'errorCode', 'ajaxSetup', 'headers']:
    idx = content.find(term)
    if idx >= 0:
        print(f'\n=== {term} ===')
        print(content[idx:idx+400])
