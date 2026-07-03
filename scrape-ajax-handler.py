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

# Check each script for AjaxGlobalHandler
script_urls = [
    'https://pod.planetaltig.com/common/scripts?v=2BDNJmnbg3aRp0e0_W5EfbuETd2F7HgQ62imnNha1A41',
    'https://pod.planetaltig.com/common/scriptsOther?v=g_u6o9Eb4Wlq-sF9CsMZgyMaUVIKE_elgv8bkhAtYrE1',
    'https://pod.planetaltig.com/Scripts/app/inspinia?v=IycKpdkiKF4NQLMcCkN1L8jS9mrYxzd6REto6Kold-E1',
]

for url in script_urls:
    resp = opener.open(url)
    content = resp.read().decode('utf-8', errors='replace')
    idx = content.find('AjaxGlobalHandler')
    if idx >= 0:
        print(f'\nFound AjaxGlobalHandler in {url.split("?")[0].split("/")[-1]}:')
        print(content[idx:idx+800])
        break
