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

# Get Account/List page and examine the JS for getUserList params
resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')
print('Account/List status, length:', len(content))

# Save full page for inspection
with open('account-list-page.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Saved to account-list-page.html')

# Search for getUserList
idx = content.find('getUserList')
if idx >= 0:
    print('\ngetUserList context:')
    print(content[max(0,idx-200):idx+500])
else:
    print('getUserList not found in page')
    # Look for any ajax calls
    ajax_calls = re.findall(r'ajax\({[^}]+}', content)
    print('Ajax calls found:', len(ajax_calls))
    for call in ajax_calls[:3]:
        print(call[:200])

# Look for any DataTable initialization  
dt_idx = content.find('DataTable')
if dt_idx >= 0:
    print('\nDataTable context:')
    print(content[dt_idx:dt_idx+500])
