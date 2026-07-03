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
list_content = list_resp.read().decode('utf-8', errors='replace')

# Find the full ajax data function
idx = list_content.find('"data" : function')
print(list_content[idx:idx+800])
