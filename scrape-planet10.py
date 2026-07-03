import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [
    ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    ('X-Requested-With', 'XMLHttpRequest'),
    ('Content-Type', 'application/x-www-form-urlencoded'),
    ('Accept', 'application/json, text/javascript, */*; q=0.01'),
    ('Referer', 'https://pod.planetaltig.com/Account/List'),
]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# POST to getUserList with DataTables params
params = {
    'draw': '1',
    'start': '0',
    'length': '1000',
    'userstatus': '',
    'SearchByRole': '',
    'OfficeId': '',
    'Username': '',
    'FirstName': '',
    'LastName': '',
    'Phone': '',
    'Email': '',
    'SearchStatus': '',
    'columns[0][data]': 'FullName',
    'order[0][column]': '1',
    'order[0][dir]': 'asc',
}

req = urllib.request.Request(
    'https://pod.planetaltig.com/account/getUserList?userstatus=&SearchByRole=&OfficeId=',
    data=urllib.parse.urlencode(params).encode(),
    headers={
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://pod.planetaltig.com/Account/List',
    }
)

resp = opener.open(req)
content = resp.read().decode('utf-8', errors='replace')
print('Status:', resp.getcode())
print('Length:', len(content))
print('First 1000:', content[:1000])
