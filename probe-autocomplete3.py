import requests
import re
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120'})

# Login
r = s.post('https://pod.planetaltig.com/Account/Login', data={
    'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'
}, allow_redirects=True)
print('Logged in:', r.url)

# Get the Account/List page and extract the antiforgery token from it + JS
al = s.get('https://pod.planetaltig.com/Account/List')
print('Account/List status:', al.status_code, 'len:', len(al.text))

# Extract antiforgery token
aft = re.search(r'__RequestVerificationToken.*?value="([^"]+)"', al.text)
print('Antiforgery token:', aft.group(1)[:30] if aft else 'NOT FOUND')

# Find what JS files are loaded
scripts = re.findall(r'<script[^>]+src="([^"]+)"', al.text)
print('Script files:', scripts[:10])

# Look for autocomplete endpoint in page
for term in ['AutoComplete', 'autocomplete', 'typeahead', 'searchBar', 'search']:
    idx = al.text.find(term)
    if idx >= 0:
        print(f'\n=== {term} at {idx} ===')
        print(al.text[max(0, idx-100):idx+400])

# Also look for what search endpoint is used on Account/List page
idx2 = al.text.find('getUserList')
print(f'\n=== getUserList context ===')
print(al.text[max(0,idx2-50):idx2+200])

# Check if there's a separate search-as-you-type for the name field
name_search = re.search(r'SearchAssociate[^"]*|searchAssociate[^"]*', al.text)
if name_search:
    print('\nSearchAssociate context:', al.text[name_search.start()-100:name_search.start()+300])
