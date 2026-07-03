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

resp = opener.open('https://pod.planetaltig.com/Report/LeadSearch')
content = resp.read().decode('utf-8', errors='replace')

# Find all scripts loaded
scripts = re.findall(r'src="(/[^"]+)"', content)
print('Internal scripts:', [s for s in scripts if not s.startswith('http')][:10])

# Look for the custom error handler or AJAX setup
common_resp = opener.open('https://pod.planetaltig.com/common/scripts?v=2BDNJmnbg3aRp0e0_W5EfbuETd2F7HgQ62imnNha1A41')
common = common_resp.read().decode('utf-8', errors='replace')

# Find ajaxSetup or error11 
for term in ['Error11', 'errorCode', 'ajaxSetup', 'beforeSend', 'RequestVerification']:
    idx = common.find(term)
    if idx >= 0:
        print(f'\n=== {term} in common/scripts ===')
        print(common[idx:idx+300])

# Also check the customScript
custom_resp = opener.open('https://pod.planetaltig.com/custom/customScript?v=8OTd2za8YanWv6oY9A3wLBRdNKKPXMOaFxgXwZb_QsE1')
custom = custom_resp.read().decode('utf-8', errors='replace')
print('\n=== customScript full content ===')
print(custom[:2000])
