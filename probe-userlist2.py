import urllib.request
import urllib.parse
import http.cookiejar
import re
import json

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Read full JS around getUserList to see all params and response format
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

idx = content.find('getUserList')
print('=== Full getUserList context (1500 chars) ===')
print(content[max(0,idx-300):idx+1200])

# Also look for how search results populate and what columns come back
idx2 = content.find('SearchStatus')
if idx2 >= 0:
    print('\n=== SearchStatus context ===')
    print(content[max(0,idx2-100):idx2+600])

# Look for what data columns come back
idx3 = content.find('"columns"')
if idx3 < 0:
    idx3 = content.find("'columns'")
if idx3 >= 0:
    print('\n=== columns context ===')
    print(content[idx3:idx3+800])
