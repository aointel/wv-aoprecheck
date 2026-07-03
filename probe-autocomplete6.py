import requests, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Load home page
home = s.get('https://pod.planetaltig.com/')

# The full URL from LoadTypeHead:
# /Home/AutoCompleteAssociateHierarchy?showterminatedonly=false
# &officeID=0&contextID=1&searchByAgentNumber=false&searchByPhoneNumber=false
# And the typeahead plugin sends &query=<term>

base_url = 'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy'
params_base = {
    'showterminatedonly': 'false',
    'officeID': '0',
    'contextID': '1',
    'searchByAgentNumber': 'false',
    'searchByPhoneNumber': 'false',
}

for term in ['Lawrence', 'Blanding', 'Stander', 'Greco', 'Smith']:
    params = {**params_base, 'query': term}
    resp = s.get(base_url, params=params, headers={
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://pod.planetaltig.com/',
    })
    print(f'term={term}: status={resp.status_code} len={len(resp.text)}')
    if resp.status_code == 200:
        print(f'  RESULT: {resp.text[:500]}')
    else:
        print(f'  error body: {resp.text[:100]}')
