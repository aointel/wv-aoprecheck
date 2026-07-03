import requests, re, sys, time
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
s.get('https://pod.planetaltig.com/')

MY_ASSOC = '231'

def search(term, terminated=False):
    r = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', params={
        'showterminatedonly': 'true' if terminated else 'false',
        'officeID': '0', 'contextID': '1',
        'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'search': term,
    }, headers={'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://pod.planetaltig.com/'}, timeout=15)
    return r.json() if r.status_code == 200 else []

def extract_name(h):
    m = re.search(r'>([^<>]+?)\s*-\s*\d+\s*<', h)
    return m.group(1).strip() if m else re.sub(r'<[^>]+>', '', h).strip()

def get_details(user_id):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=10)
    if r.status_code != 200: return None
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    assoc_id = assoc_m.group(1) if assoc_m else None
    if not assoc_id or assoc_id == MY_ASSOC: return None
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    name_m = re.search(r'<h[12][^>]*>\s*([^<]{3,60})\s*</h[12]>', html)
    return {'associate_id': assoc_id, 'company_email': emails[0].lower() if emails else None,
            'page_name': name_m.group(1).strip() if name_m else None}

def sb_update(agent_name, patch):
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.{requests.utils.quote(agent_name)}&select=id',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
    rows = resp.json()
    if rows:
        r = requests.patch(f'{SUPABASE_URL}/rest/v1/customers?id=eq.{rows[0]["id"]}',
            headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
            json=patch)
        return r.status_code
    return None

# Try autocomplete with terminated=true for both names
print('=== Searching with terminated=true ===')
for term in ['Walker', 'Paul']:
    results = search(term, terminated=True)
    hits_235 = [(extract_name(r.get('FullName','')), r['AssociateId'], r['UserId'])
                for r in results if str(r['AssociateId']).startswith('235')]
    print(f'{term} (terminated=true, {len(results)} total, 235xxx hits: {len(hits_235)}):')
    for n, aid, uid in hits_235:
        print(f'  {n} assoc={aid}')

# Also search "Walk" to get more Walker results (autocomplete may cut off)
print('\n=== Searching "Walk" to catch more ===')
results = search('Walk')
for r in results:
    name = extract_name(r.get('FullName',''))
    if str(r['AssociateId']).startswith('235'):
        print(f'  {name} assoc={r["AssociateId"]}')

# Scan 235500-235800
print('\nScanning 235500-235800 for Walker/Paul...')
for uid in range(235500, 235800):
    d = get_details(uid)
    if d:
        name = (d.get('page_name') or '').upper()
        if 'WALKER' in name or 'PAUL' in name:
            print(f'  *** uid={uid}: assoc={d["associate_id"]} name={d["page_name"]} email={d["company_email"]}')
            # Update DB if it's the right one
            if 'WALKER' in name and 'ANDREW' in name:
                code = sb_update('Andrew Walker', {'associate_id': int(d['associate_id']), 'company_email': d['company_email']})
                print(f'    -> Updated Andrew Walker: {code}')
            if 'PAUL' in name and 'NICOLE' in name:
                code = sb_update('Nicole Paul', {'associate_id': int(d['associate_id']), 'company_email': d['company_email']})
                print(f'    -> Updated Nicole Paul: {code}')
    time.sleep(0.05)

print('Done.')
