import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', data)

resp = opener.open('https://pod.planetaltig.com/Account/List')
content = resp.read().decode('utf-8', errors='replace')

# Find ajax/api URLs
ajax_urls = re.findall(r'["\'](/[A-Za-z/]+(?:GetAll|List|Search|Data|Json)[^"\']*)["\']', content)
print('Ajax URLs found:', ajax_urls[:10])

# Also look for any URL patterns
urls = re.findall(r'url\s*:\s*["\']([^"\']+)["\']', content)
print('URL patterns:', urls[:10])

# Look for datatables ajax source
dt_ajax = re.findall(r'ajax["\s:]+["\']([^"\']+)["\']', content)
print('DT ajax:', dt_ajax[:10])
