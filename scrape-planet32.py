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

# Check the typeahead scripts - this is for autocomplete search
resp = opener.open('https://pod.planetaltig.com/typeahead/scripts?v=INI7Zgf0JzhRny18z336_TlUg2wpb2xnq-8oNEXeY481')
content = resp.read().decode('utf-8', errors='replace')
print('typeahead script length:', len(content))

# Look for API endpoints in the typeahead script
urls = re.findall(r'[\'"]([/][A-Za-z/]+)[\'"]', content)
print('URLs in typeahead:', sorted(set(u for u in urls if len(u) > 5))[:20])

# Try the search in home page nav
idx = content.find('search')
if idx >= 0:
    print('\nSearch context:', content[idx:idx+300])
