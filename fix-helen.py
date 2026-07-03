import requests, re, sys
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

# Find Helen Bradley - get the proper UserId from autocomplete
print('=== Helen Bradley ===')
results = search('Helen')
for r in results:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} assoc={r["AssociateId"]} userId={r["UserId"]}')
    if 'HELEN' in n.upper() and 'BRADLEY' in n.upper():
        d = get_details(r['UserId'])
        print(f'  -> Details: assoc={d["associate_id"]}, email={d["company_email"]}, name={d["page_name"]}')
        # Update DB
        resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.Helen%20Bradley&select=id',
            headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
        )
        rows = resp.json()
        if rows:
            patch = requests.patch(
                f'{SUPABASE_URL}/rest/v1/customers?id=eq.{rows[0]["id"]}',
                headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
                json={'associate_id': int(d['associate_id']), 'company_email': d['company_email']}
            )
            print(f'  DB update: {patch.status_code}')

# Andrew Walker and Nicole Paul - check if they exist via different name formats
print('\n=== Andrew Walker ===')
# Try searching just "Andrew" and look for Walker
for r in search('Andrew'):
    n = extract_name(r.get('FullName',''))
    if 'WALKER' in n.upper() or 'WALK' in n.upper():
        print(f'  HIT: {n} assoc={r["AssociateId"]} userId={r["UserId"]}')

# Nicole Paul
print('\n=== Nicole Paul ===')
for r in search('Nicole'):
    n = extract_name(r.get('FullName',''))
    if 'PAUL' in n.upper():
        print(f'  HIT: {n} assoc={r["AssociateId"]} userId={r["UserId"]}')
        d = get_details(r['UserId'])
        print(f'  -> email={d["company_email"]}, assoc={d["associate_id"]}')

# Neither found? Insert as shell records
print('\n=== Checking DB for Andrew Walker and Nicole Paul ===')
for name in ['Andrew Walker', 'Nicole Paul']:
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.{requests.utils.quote(name)}&select=id,associate_id,company_email',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
    )
    print(f'{name}: {resp.json()}')
