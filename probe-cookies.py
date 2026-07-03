import requests, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
r = s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

print('Cookies after login:')
for name, val in s.cookies.items():
    print(f'  {name}: {val[:60]}')

# Load home page
home = s.get('https://pod.planetaltig.com/')
print('\nCookies after home:')
for name, val in s.cookies.items():
    print(f'  {name}: {val[:80]}')

# Check response headers for the autocomplete 400
resp = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', 
    params={'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1', 
            'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'query': 'Smith'},
    headers={'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json'})
print(f'\nAutocomplete status: {resp.status_code}')
print('Response headers:')
for k, v in resp.headers.items():
    print(f'  {k}: {v}')
print('Body:', resp.text[:200])
