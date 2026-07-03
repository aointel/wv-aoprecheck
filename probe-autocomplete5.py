import requests, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Load home page to get officeID and changecontext values
home = s.get('https://pod.planetaltig.com/')

# Find office and context hidden inputs
office_m = re.search(r'id="office"[^>]*value="([^"]*)"', home.text)
context_m = re.search(r'id="changecontext"[^>]*value="([^"]*)"', home.text)
print('office:', office_m.group(1) if office_m else 'NOT FOUND')
print('changecontext:', context_m.group(1) if context_m else 'NOT FOUND')

# Show more of that section
idx = home.text.find('GetLookupUrl')
print('\n=== Full typeahead setup ===')
print(home.text[idx:idx+1000])

# Find byAgentNumber and byPhoneNumber
bn_m = re.search(r'byAgentNumber\s*=\s*([^;,\)]+)', home.text)
bp_m = re.search(r'byPhoneNumber\s*=\s*([^;,\)]+)', home.text)
print('byAgentNumber:', bn_m.group(1) if bn_m else 'NOT FOUND')
print('byPhoneNumber:', bp_m.group(1) if bp_m else 'NOT FOUND')

# Find the hidden inputs
for id_name in ['office', 'changecontext', 'hiddenUserType']:
    m = re.search(rf'id="{id_name}"[^>]*>', home.text)
    if m:
        print(f'\nInput [{id_name}]:', home.text[m.start():m.start()+200])
