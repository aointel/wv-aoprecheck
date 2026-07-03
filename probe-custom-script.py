import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Get the custom script
r = s.get('https://pod.planetaltig.com/custom/customScript?v=8OTd2za8YanWv6oY9A3wLBRdNKKPXMOaFxgXwZb_QsE1')
print('customScript len:', len(r.text))

# Find AutoCompleteAssociateHierarchy usage
idx = r.text.find('AutoComplete')
if idx >= 0:
    print('\n=== AutoComplete in custom script ===')
    print(r.text[max(0,idx-300):idx+600])

# Find ajaxSetup or beforeSend
for term in ['ajaxSetup', 'beforeSend', 'RequestVerification', 'header', 'preDispatch']:
    idx = r.text.find(term)
    if idx >= 0:
        print(f'\n=== {term} ===')
        print(r.text[max(0,idx-50):idx+400])

# Also check the common/scriptsOther
r2 = s.get('https://pod.planetaltig.com/common/scriptsOther?v=g_u6o9Eb4Wlq-sF9CsMZgyMaUVIKE_elgv8bkhAtYrE1')
print('\n\nscriptsOther len:', len(r2.text))
for term in ['ajaxSetup', 'beforeSend', 'RequestVerification', 'AutoComplete']:
    idx = r2.text.find(term)
    if idx >= 0:
        print(f'\n=== {term} in scriptsOther ===')
        print(r2.text[max(0,idx-50):idx+400])
