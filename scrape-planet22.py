import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

list_resp = opener.open('https://pod.planetaltig.com/Account/List')
content = list_resp.read().decode('utf-8', errors='replace')

# Find all hidden inputs
hidden_inputs = re.findall(r'<input[^>]+type=["\']hidden["\'][^>]*>', content)
print('Hidden inputs:')
for h in hidden_inputs:
    print(h)

# Check for admin key in scripts
print('\n=== OnboardKey / admin params ===')
for term in ['OnboardKey', 'adminToken', 'CsrfToken', '__RequestVerification', 'X-CSRF']:
    idx = content.find(term)
    if idx >= 0:
        print(f'{term}:', content[idx:idx+100])
