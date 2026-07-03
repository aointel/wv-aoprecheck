import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# The main common/scripts has the ajaxSetup
r = s.get('https://pod.planetaltig.com/common/scripts?v=2BDNJmnbg3aRp0e0_W5EfbuETd2F7HgQ62imnNha1A41')
print('common/scripts len:', len(r.text))

# Search for ajaxSetup
for term in ['ajaxSetup', 'beforeSend', 'RequestVerif', 'AutoComplete', 'Error11']:
    idx = 0
    while True:
        idx = r.text.find(term, idx)
        if idx < 0:
            break
        print(f'\n=== {term} at {idx} ===')
        print(r.text[max(0,idx-100):idx+400])
        idx += len(term)

# Check the member/scripts
r3 = s.get('https://pod.planetaltig.com/member/scripts?v=CZ35N2D_9sirjXf2V1voK_JImISWlQ0SK9Yp97j4QL41')
print('\n\nmember/scripts len:', len(r3.text))
for term in ['ajaxSetup', 'beforeSend', 'RequestVerif', 'AutoComplete']:
    idx = r3.text.find(term)
    if idx >= 0:
        print(f'\n=== {term} in member/scripts ===')
        print(r3.text[max(0,idx-100):idx+500])
