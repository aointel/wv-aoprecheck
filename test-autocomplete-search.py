import requests, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
s.get('https://pod.planetaltig.com/')  # load home to initialize session

base_url = 'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy'

for term in ['Lawrence', 'Blanding', 'Smith', 'Greco', 'Stander']:
    resp = s.get(base_url, params={
        'showterminatedonly': 'false',
        'officeID': '0',
        'contextID': '1',
        'searchByAgentNumber': 'false',
        'searchByPhoneNumber': 'false',
        'search': term,
    }, headers={
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://pod.planetaltig.com/',
    })
    print(f'term={term}: status={resp.status_code} len={len(resp.text)}')
    if resp.status_code == 200:
        try:
            data = resp.json()
            print(f'  items: {len(data)}')
            if data:
                print(f'  first: {json.dumps(data[0])[:300]}')
        except:
            print(f'  raw: {resp.text[:300]}')
    else:
        print(f'  error: {resp.text[:100]}')
