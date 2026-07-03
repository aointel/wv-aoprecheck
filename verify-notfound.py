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

not_found = [
    "Aaron Lowell Stander", "Adaisha Darby", "Amy Jo Knight Commander",
    "Boris Koprivica", "Bruce L Moxley", "Camila Dalbem Andrade",
    "Dontaeja Smart", "Eric Geiss", "Fidel R Escobar", "George Carl Tockstein",
    "Jiael Zenia Astwood", "Jonathan Carrero", "Kristian Portante",
    "Krystal K Redding", "Kyra Hopkins", "Kywan Gilbert Jasper Sheppard",
    "Michael N Locke", "Nicholas Walker", "Pamela Sue Faircloth",
    "Paul Michael Demeo", "Robert Lee Jones", "Ryan Wilson",
    "Samuel Donadio", "Timothy Matthew Wilson", "Treyson Scott",
    "William Frederick Lawson"
]

for name in not_found:
    last = name.split()[-1]
    first = name.split()[0]
    results = search(last)
    # Check if any result matches first name AND has 235xxx
    hits_235 = [r for r in results if str(r['AssociateId']).startswith('235')]
    first_match = [r for r in hits_235 if first.upper() in extract_name(r.get('FullName','')).upper()]
    
    if first_match:
        n = extract_name(first_match[0].get('FullName',''))
        print(f'  ✅ FOUND: {name} -> {n} assoc={first_match[0]["AssociateId"]}')
    elif hits_235:
        names_235 = [extract_name(r.get('FullName','')) for r in hits_235]
        print(f'  ⚠️  {name}: 235xxx results but no first match: {names_235}')
    else:
        print(f'  ❌ {name}: last="{last}" -> {len(results)} results, none 235xxx')
