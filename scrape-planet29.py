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

def name_to_alias(name):
    # "Aaron G Lawrence" -> "aaronglawrence"
    # "Carolina Jorge F Richmond, Mrs" -> "carolinajorgefrichmondmrs" (remove comma/space, lowercase)
    import re
    clean = re.sub(r'[^a-zA-Z\s]', '', name)  # remove non-alpha except spaces
    parts = clean.lower().split()
    return ''.join(parts)

def get_associate_id(name):
    alias = name_to_alias(name)
    url = f'https://pod.planetaltig.com/Account/Edit?alias={alias}'
    try:
        resp = opener.open(url)
        content = resp.read().decode('utf-8', errors='replace')
        final_url = resp.geturl()
        if 'login' in final_url.lower() or 'error' in final_url.lower():
            return None, None, alias
        # Extract AssociateId
        assoc = re.search(r'id="AssociateId"[^>]*value="(\d+)"', content)
        # Extract email
        email = re.search(r'value="([^"]+@aoglobelife\.com)"', content)
        if assoc:
            return assoc.group(1), email.group(1) if email else f'{alias}@aoglobelife.com', alias
    except:
        pass
    return None, None, alias

# Test with known names
test_names = ['Aaron G Lawrence', 'Aaron Lowell Stander', 'Adaisha Darby']
for name in test_names:
    aid, email, alias = get_associate_id(name)
    print(f'{name} -> alias={alias} id={aid} email={email}')
    time.sleep(0.2)
