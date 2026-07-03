import urllib.request
import urllib.parse
import http.cookiejar
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# The homepage nav had a search bar - let's find it
resp = opener.open('https://pod.planetaltig.com/')
content = resp.read().decode('utf-8', errors='replace')

# Find search-related endpoints in the JS
print('=== All /Account/ links ===')
account_links = re.findall(r'[\'"/]Account/([A-Za-z]+)[\'"\?]', content)
print(sorted(set(account_links)))

# Try the search bar endpoint
print('\n=== Search bar code ===')
idx = content.find('SearchTxt')
if idx < 0:
    idx = content.find('search-bar')
if idx < 0:
    idx = content.find('typeahead')
if idx >= 0:
    print(content[idx:idx+500])

# Check Report/LeadSearch for agent lookup
resp2 = opener.open('https://pod.planetaltig.com/Report/LeadSearch')
content2 = resp2.read().decode('utf-8', errors='replace')
# Find agent-related endpoints
agent_urls = re.findall(r'[\'"]([/][^\'"\s]+agent[^\'"\s]*)[\'"]', content2, re.IGNORECASE)
print('\n=== Agent URLs in LeadSearch ===')
print(agent_urls[:10])
