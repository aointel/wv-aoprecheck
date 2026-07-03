import requests
import re
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120'})

# Login
login_page = s.get('https://pod.planetaltig.com/Account/Login')
token_m = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', login_page.text)
token = token_m.group(1) if token_m else ''
print('CSRF token found:', bool(token))

r = s.post('https://pod.planetaltig.com/Account/Login', data={
    'Alias': 'michaelmandella',
    'Password': 'C8fkef8agyeh!!',
    '__RequestVerificationToken': token
}, allow_redirects=True)
print('Logged in, URL:', r.url)

# Load the LeadSearch page to get session context + any JS-set cookies
ls = s.get('https://pod.planetaltig.com/Report/LeadSearch')
print('LeadSearch status:', ls.status_code)

# Also load Account/List for context
al = s.get('https://pod.planetaltig.com/Account/List')

# Now try the autocomplete with various header combos
# The JS shows: baseurl + "?showterminatedonly=" + istrue
# and it's used as a Bootstrap Typeahead source

test_terms = ['Lawrence', 'Blanding', 'Stander', 'Gre', 'Wil']

for term in test_terms:
    # Try 1: basic
    url = f'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy?term={requests.utils.quote(term)}&showterminatedonly=false'
    resp = s.get(url, headers={
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://pod.planetaltig.com/Report/LeadSearch',
    })
    print(f'\nterm={term}: status={resp.status_code} len={len(resp.text)}')
    if resp.status_code == 200:
        print(f'  content: {resp.text[:300]}')
    else:
        print(f'  error: {resp.text[:200]}')
