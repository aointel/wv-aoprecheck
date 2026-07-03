import requests, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
s.get('https://pod.planetaltig.com/')

def search(term):
    r = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', params={
        'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1',
        'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'search': term,
    }, headers={'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://pod.planetaltig.com/'}, timeout=15)
    return r.json() if r.status_code == 200 else []

def extract_name(full_html):
    m = re.search(r'>([^<>]+?)\s*-\s*\d+\s*<', full_html)
    return m.group(1).strip() if m else re.sub(r'<[^>]+>', '', full_html).strip()

def get_details(user_id):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=15)
    if r.status_code != 200: return None
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    name_m = re.search(r'<h[12][^>]*>\s*([^<]{3,60})\s*</h[12]>', html)
    return {
        'associate_id': assoc_m.group(1) if assoc_m else None,
        'company_email': emails[0].lower() if emails else None,
        'page_name': name_m.group(1).strip() if name_m else None,
    }

# 1. Check Helen Bradley - was matched to assoc=236243 with email noahbradleyholmes@...
print('=== Checking Helen Bradley (assoc 236243) ===')
d = get_details(236243)
print(f'  page_name={d["page_name"]}, email={d["company_email"]}, assoc={d["associate_id"]}')

# Search fresh for Helen Bradley
print('\nSearching "Bradley":')
for r in search('Bradley')[:8]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')

print('\nSearching "Helen":')
for r in search('Helen')[:8]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')

# 2. Andrew Walker
print('\n=== Andrew Walker ===')
print('Searching "Andrew Walker":')
for r in search('Andrew Walker')[:5]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')
print('Searching "andrewwalker":')
for r in search('andrewwalker')[:5]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')

# 3. Nicole Paul
print('\n=== Nicole Paul ===')
print('Searching "Nicole Paul":')
for r in search('Nicole Paul')[:5]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')
print('Searching "nicolepaul":')
for r in search('nicolepaul')[:5]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')
print('Searching "Nicolep":')
for r in search('Nicolep')[:5]:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]})')
