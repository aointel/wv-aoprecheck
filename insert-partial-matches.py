import requests, re, sys, time
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
sb_headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'}

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

def get_details(user_id):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=10)
    if r.status_code != 200: return None
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    assoc_id = assoc_m.group(1) if assoc_m else None
    if not assoc_id or assoc_id == '231': return None
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    return {'associate_id': assoc_id, 'company_email': emails[0].lower() if emails else None}

def sb_update(agent_name, patch):
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?agent_name=ilike.*{requests.utils.quote(agent_name.split()[0])}*&last_name=ilike.{requests.utils.quote(agent_name.split()[-1])}&select=id,agent_name',
        headers=sb_headers)
    rows = resp.json()
    if not rows:
        # try exact
        resp2 = requests.get(
            f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.{requests.utils.quote(agent_name)}&select=id',
            headers=sb_headers)
        rows = resp2.json()
    if rows:
        r = requests.patch(f'{SUPABASE_URL}/rest/v1/customers?id=eq.{rows[0]["id"]}',
            headers=sb_headers, json=patch)
        return r.status_code, rows[0].get('agent_name', agent_name)
    return None, None

def sb_insert(row):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/customers',
        headers={**sb_headers, 'Prefer': 'return=representation'}, json=row)
    return r.status_code

# Candidates: (agent_name, last_name_to_search, pick_hint)
# pick_hint = substring to find in planet results to pick the right one
candidates = [
    ('Treyson Scott',           'Scott',   'Trey'),
    ('William Frederick Lawson','Lawson',  'Will'),
    ('Camila Dalbem Andrade',   'Andrade', 'Camila'),
    ('Kyra Hopkins',            'Hopkins', 'Kyra'),
    ('Robert Lee Jones',        'Jones',   'Robert'),
    ('Ryan Wilson',             'Wilson',  'Ryan'),
    ('Timothy Matthew Wilson',  'Wilson',  'Timothy'),
]

import csv
# Load states CSV for later
with open(r'C:\Users\mmand\OneDrive\Documents\statelistbveacaum.csv', encoding='utf-8-sig') as f:
    states_map = {}
    for row in csv.DictReader(f):
        states_map[row['Agent Name'].strip()] = ', '.join(
            k for k,v in row.items() if k not in ('Agent Name','Total') and v.strip() in ('R','NR'))

for agent_name, last, hint in candidates:
    print(f'\n=== {agent_name} (searching "{last}", hint="{hint}") ===')
    results = search(last)
    hits_235 = [r for r in results if str(r['AssociateId']).startswith('235')]
    
    # Try to match hint in name
    match = None
    for r in hits_235:
        n = extract_name(r.get('FullName', ''))
        if hint.upper() in n.upper():
            match = r
            print(f'  Match: {n} assoc={r["AssociateId"]}')
            break
    
    if not match and hits_235:
        # Just take first 235xxx
        match = hits_235[0]
        print(f'  Best guess: {extract_name(match.get("FullName",""))} assoc={match["AssociateId"]}')
    
    if not match:
        print(f'  No 235xxx found, skipping')
        continue
    
    d = get_details(match['UserId'])
    if not d:
        print(f'  Could not get details')
        continue
    
    print(f'  email={d["company_email"]}, assoc={d["associate_id"]}')
    
    # Get states for this agent
    states = None
    for csv_name, s_val in states_map.items():
        parts = agent_name.split()
        if parts[0].upper() in csv_name.upper() and parts[-1].upper() in csv_name.upper():
            states = s_val
            break
    
    patch = {
        'associate_id': int(d['associate_id']),
        'company_email': d['company_email'],
        'market': ['Globe Market'],
    }
    if states:
        patch['states'] = states
        print(f'  states={states}')
    
    code, matched_name = sb_update(agent_name, patch)
    if code == 204:
        print(f'  ✅ Updated existing: {matched_name}')
    else:
        # Insert new
        parts = agent_name.split()
        row = {
            'first_name': parts[0], 'last_name': parts[-1],
            'agent_name': agent_name, 'status': 'active',
            'market': ['Globe Market'],
            **patch
        }
        icode = sb_insert(row)
        print(f'  {"✅ Inserted" if icode in (200,201) else "❌ Failed"}: {icode}')
    
    time.sleep(0.3)

print('\nDone.')
