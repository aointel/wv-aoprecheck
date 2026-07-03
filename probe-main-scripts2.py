import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Load the home page - the typeahead is initialized from there
home = s.get('https://pod.planetaltig.com/')
print('Home page len:', len(home.text))

# Find the AutoCompleteAssociateHierarchy and LoadTypeHead context
idx = home.text.find('AutoCompleteAssociate')
if idx >= 0:
    print('\n=== AutoComplete in home page ===')
    print(home.text[max(0,idx-500):idx+800])

# Find antiforgery token in home page
aft = re.search(r'RequestVerificationToken[^"]*"[^"]+"\s+value="([^"]+)"', home.text)
aft2 = re.search(r'"__RequestVerificationToken","([^"]+)"', home.text)
aft3 = re.search(r"'__RequestVerificationToken','([^']+)'", home.text)
aft4 = re.findall(r'RequestVerificationToken.*?value="([^"]+)"', home.text)
print('\nAFT1:', aft.group(1)[:30] if aft else None)
print('AFT2:', aft2.group(1)[:30] if aft2 else None)
print('AFT3:', aft3.group(1)[:30] if aft3 else None)
print('AFT4:', aft4[:2])

# Check if there's an antiforgery token set globally via JS
idx2 = home.text.find('VerificationToken')
while idx2 >= 0:
    print(f'\n=== VerificationToken at {idx2} ===')
    print(home.text[max(0,idx2-100):idx2+300])
    idx2 = home.text.find('VerificationToken', idx2+1)
    if idx2 > 0:
        # limit to first 3
        count = home.text[:idx2].count('VerificationToken')
        if count >= 3:
            break
