import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re
import time

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Fetch AssociateDetails for aaronglawrence and look at the full structure
resp = opener.open('https://pod.planetaltig.com/AssociateDetails?u=aaronglawrence')
content = resp.read().decode('utf-8', errors='replace')

# Look for associate ID patterns
print('=== Looking for ID patterns ===')
# Look for numbers that could be associate IDs (6-7 digits)
numbers_6_7 = re.findall(r'\b(\d{6,7})\b', content)
print('6-7 digit numbers:', list(set(numbers_6_7))[:10])

# Look for specific fields
for term in ['AssociateId', 'associate_id', 'associateid', 'Associate ID', 'AssocId']:
    idx = content.find(term)
    if idx >= 0:
        print(f'\n{term}:', content[idx:idx+100])

# Check email fields  
emails = re.findall(r'[a-zA-Z0-9.]+@aoglobelife\.com', content)
print('\nEmails found:', emails[:5])

# Check title/name
title_match = re.search(r'<title>([^<]+)</title>', content)
print('Page title:', title_match.group(1) if title_match else 'N/A')

# Look for the profile header with name
name_match = re.search(r'<h[1-3][^>]*>([^<]+)</h[1-3]>', content)
print('H tag:', name_match.group(1) if name_match else 'N/A')

# Show a 200 char snippet after any mention of "aaronglawrence"
idx = content.find('aaronglawrence')
if idx >= 0:
    print('\nContext around alias:', content[idx:idx+200])
