import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Look at what params the datatable actually sends by checking the JS more carefully
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Find all the data params being sent
idx = content.find('getUserList')
ctx = content[max(0,idx-500):idx+1000]
print(ctx)
