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

# The error code 11 might be missing admin token in header
# Let me check Account/List page for any token in the page
list_resp = opener.open('https://pod.planetaltig.com/Account/List')
content = list_resp.read().decode('utf-8', errors='replace')

# Check for any token patterns
print('=== AntiForgery tokens ===')
tokens = re.findall(r'value="([A-Za-z0-9+/=_\-]{40,})"', content)
for t in tokens[:5]:
    print(t[:60])

# Check for AdminToken or similar
print('\n=== Admin/Bearer tokens ===')
admin = re.findall(r'(token|Token|bearer|Bearer|AdminToken)["\s:=]+["\']([^"\']{20,})["\']', content)
for a in admin[:5]:
    print(a)

# Find the IsAdministrator value
print('\n=== IsAdministrator ===')
idx = content.find('IsAdministrator')
print(content[idx:idx+100])

# Try with referrer-based approach - fetch the getUserList from the exact same path
# Error11 might be CSRF - try to find it in hidden form
forms = re.findall(r'<form[^>]+>(.*?)</form>', content, re.DOTALL)
print(f'\nForms found: {len(forms)}')
for f in forms[:2]:
    hidden = re.findall(r'<input[^>]+hidden[^>]*>', f)
    print('Hidden inputs:', hidden[:3])
