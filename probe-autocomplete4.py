import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Load the home page to get typeahead initialized (sets cookies etc.)
home = s.get('https://pod.planetaltig.com/')

test_terms = ['Lawrence', 'Blanding', 'Gre']

for term in test_terms:
    # Try with 'query' param (what typeahead sends)
    url = 'https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy'
    
    for params in [
        {'query': term, 'showterminatedonly': 'false'},
        {'term': term, 'showterminatedonly': 'false'},
        {'q': term, 'showterminatedonly': 'false'},
        {'query': term},
    ]:
        resp = s.get(url, params=params, headers={
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*',
            'Referer': 'https://pod.planetaltig.com/',
        })
        print(f'term={term} params={list(params.keys())}: status={resp.status_code} len={len(resp.text)}')
        if resp.status_code == 200 and len(resp.text) > 2:
            print(f'  RESULT: {resp.text[:400]}')
            break
        elif resp.status_code != 400:
            print(f'  response: {resp.text[:100]}')
