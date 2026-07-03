import urllib.request
import urllib.parse
import http.cookiejar
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Let's check ALL scripts loaded on the homepage for search endpoints
resp = opener.open('https://pod.planetaltig.com/')
content = resp.read().decode('utf-8', errors='replace')

# Get all script srcs
scripts = re.findall(r'src="([^"]+)"', content)
print('Scripts:', [s for s in scripts if 'pod.planet' in s or s.startswith('/')][:10])

# Look for any AJAX calls in the page
ajax_calls = re.findall(r'\.ajax\s*\(\s*\{[^}]+url\s*:\s*["\']([^"\']+)["\']', content)
print('\nAJAX calls:', ajax_calls[:10])

# Also look for the global search bar
search_section = content.find('nav-search')
if search_section >= 0:
    print('\nNav search area:')
    print(content[search_section:search_section+500])

# Check the inspinia script for search endpoint
resp2 = opener.open('https://pod.planetaltig.com/Scripts/app/inspinia?v=IycKpdkiKF4NQLMcCkN1L8jS9mrYxzd6REto6Kold-E1')
inspinia = resp2.read().decode('utf-8', errors='replace')
print('\ninspinia length:', len(inspinia))
# Find search-related endpoints
search_endpoints = re.findall(r'["\']([/][A-Za-z/\?=&]+(?:search|Search|agent|Agent)[A-Za-z/\?=&]*)["\']', inspinia)
print('Search endpoints in inspinia:', search_endpoints[:10])
