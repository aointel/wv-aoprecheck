import urllib.request
import urllib.parse
import http.cookiejar
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Get the custom script which likely has search
resp = opener.open('https://pod.planetaltig.com/custom/customScript?v=8OTd2za8YanWv6oY9A3wLBRdNKKPXMOaFxgXwZb_QsE1')
custom = resp.read().decode('utf-8', errors='replace')
print('custom/customScript length:', len(custom))

# Find all URL endpoints including with quotes around them
all_urls = re.findall(r"""url\s*[:=]\s*['"]([^'"]+)['"]""", custom)
print('\nurl: endpoints:', all_urls[:20])

# Also search for ajax calls
ajax = re.findall(r"""['"]([/][A-Za-z][A-Za-z0-9/]+)['"]""", custom)
unique = sorted(set(a for a in ajax if len(a) > 8))
print('\nAll paths in customScript:')
for u in unique[:30]:
    print(' ', u)
