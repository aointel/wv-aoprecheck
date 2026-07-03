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

resp = opener.open('https://pod.planetaltig.com/common/scriptsOther?v=g_u6o9Eb4Wlq-sF9CsMZgyMaUVIKE_elgv8bkhAtYrE1')
content = resp.read().decode('utf-8', errors='replace')

# Find all instances that look like CSRF setup
# Look for $.ajaxSetup
for term in ['$.ajaxSetup', 'ajaxSetup({', 'jQuery.ajaxSetup']:
    idx = content.find(term)
    if idx >= 0:
        print(f'{term}:')
        print(content[idx:idx+500])

# Find RequestVerificationToken in any format
idx = content.find('RequestVerification')
if idx >= 0:
    print('\nRequestVerification context:')
    print(content[idx:idx+400])

# Find the Error11 handler
idx = content.find('11')
while idx >= 0 and idx < len(content):
    ctx = content[max(0,idx-20):idx+50]
    if 'error' in ctx.lower() or 'Error' in ctx:
        print(f'Error 11 context at {idx}:', ctx)
    idx = content.find('11', idx+1)
    if idx > 5000:
        break
