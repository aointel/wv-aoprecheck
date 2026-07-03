import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
s.get('https://pod.planetaltig.com/')

def search(term):
    r = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', params={
        'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1',
        'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'search': term,
    }, headers={'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://pod.planetaltig.com/'}, timeout=15)
    return r.json() if r.status_code == 200 else []

def extract_name(h):
    m = re.search(r'>([^<>]+?)\s*-\s*\d+\s*<', h)
    return m.group(1).strip() if m else re.sub(r'<[^>]+>', '', h).strip()

for term in ['Andrew Walker', 'andrewwalker', 'Andrew', 'Walker', 'Nicole Paul', 'nicolepaul', 'Nicole', 'Paul Nic']:
    results = search(term)
    matches = [extract_name(r.get('FullName','')) + f' (assoc={r["AssociateId"]})' for r in results 
               if any(x in extract_name(r.get('FullName','')).upper() for x in ['WALKER','ANDREW','PAUL','NICOLE'])]
    print(f'"{term}" ({len(results)} total): {matches[:5] if matches else "no relevant hits"}')
