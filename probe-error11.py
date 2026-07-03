import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Try GET with no X-Requested-With header  
resp = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy',
    params={'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1',
            'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'query': 'Smith'})
print(f'Without XHR header: {resp.status_code} body={resp.text[:200]}')

# Try with different Accept
resp2 = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy',
    params={'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1',
            'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'query': 'Smith'},
    headers={'Accept': '*/*'})
print(f'With Accept=*/*: {resp2.status_code} body={resp2.text[:200]}')

# Try without officeID/contextID
resp3 = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy',
    params={'showterminatedonly': 'false', 'query': 'Smith'},
    headers={'X-Requested-With': 'XMLHttpRequest'})
print(f'Without officeID/contextID: {resp3.status_code} body={resp3.text[:200]}')

# Check the full error body with urllib (different approach)
import urllib.request, urllib.parse, http.cookiejar
cj2 = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj2))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
opener.open('https://pod.planetaltig.com/Account/Login',
    urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode())

try:
    req = urllib.request.Request(
        'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?showterminatedonly=false&officeID=0&contextID=1&searchByAgentNumber=false&searchByPhoneNumber=false&query=Smith'
    )
    req.add_header('X-Requested-With', 'XMLHttpRequest')
    req.add_header('Accept', 'application/json')
    resp4 = opener.open(req)
    print(f'urllib GET: {resp4.getcode()} {resp4.read().decode()[:200]}')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'urllib error: {e.code}: body={repr(body[:200])}')
