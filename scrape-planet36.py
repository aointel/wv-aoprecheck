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

# Let's directly try to load a known agent's profile
# Using the GetProfilePic endpoint to verify ID 
# Or better - look at the bootstrap-typeahead for the search autocomplete

resp = opener.open('https://pod.planetaltig.com/bootstrap-typeahead/scripts?v=INI7Zgf0JzhRny18z336_TlUg2wpb2xnq-8oNEXeY481')
content = resp.read().decode('utf-8', errors='replace')
print('typeahead length:', len(content))

# Search for URL patterns
urls = re.findall(r"""['"]([/][A-Za-z][^'"<>\s]{5,})['"<>]""", content)
print('URLs:', sorted(set(u for u in urls if not u.endswith('.js') and not u.endswith('.css')))[:20])

# Also try searching for agents using the Report/LeadSearch with agent name autocomplete
# First, check what the LeadSearch page uses for agent lookup
resp2 = opener.open('https://pod.planetaltig.com/Report/LeadSearch')
ls = resp2.read().decode('utf-8', errors='replace')
agent_endpoints = re.findall(r"""url\s*[:=]\s*['"]([^'"]+)['"]\s*[,;]""", ls)
print('\nLeadSearch URL endpoints:', agent_endpoints[:15])

# Find typeahead source in LeadSearch
idx = ls.find('typeahead')
if idx >= 0:
    print('\nTypeahead context in LeadSearch:')
    print(ls[idx:idx+400])
