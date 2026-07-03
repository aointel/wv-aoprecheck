import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
s.get('https://pod.planetaltig.com/')

def get_details(user_id):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=15)
    if r.status_code != 200: return None
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    phone_m = re.search(r'(\(\d{3}\)\s*\d{3}-\d{4})', html)
    return {
        'associate_id': assoc_m.group(1) if assoc_m else None,
        'company_email': emails[0].lower() if emails else None,
        'phone': phone_m.group(1) if phone_m else None,
    }

def sb_update(agent_name, row):
    # Find existing record
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.{requests.utils.quote(agent_name)}&select=id',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
    )
    rows = resp.json()
    if rows:
        rid = rows[0]['id']
        r = requests.patch(
            f'{SUPABASE_URL}/rest/v1/customers?id=eq.{rid}',
            headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
            json=row
        )
        return r.status_code
    return None

def sb_insert(row):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/customers', headers={
        'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
    }, json=row)
    return r.status_code

# 1. Fix Helen Bradley - should be assoc=235137 (BRADLEY, HELEN)
print('Fixing Helen Bradley -> assoc=235137')
d = get_details(235137)
print(f'  Details: assoc={d["associate_id"]}, email={d["company_email"]}')

# Delete the wrong record (assoc=236243/236273) and insert correct one
# First check what's in DB
resp = requests.get(
    f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.Helen%20Bradley&select=id,associate_id,company_email',
    headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
)
existing = resp.json()
print(f'  Existing DB record: {existing}')

if existing:
    # Update the existing record with correct data
    code = sb_update('Helen Bradley', {
        'associate_id': int(d['associate_id']) if d['associate_id'] else None,
        'company_email': d['company_email'],
    })
    print(f'  Updated: {code}')
else:
    # Insert
    code = sb_insert({'first_name': 'Helen', 'last_name': 'Bradley', 'agent_name': 'Helen Bradley',
                       'associate_id': int(d['associate_id']), 'company_email': d['company_email'], 'status': 'active'})
    print(f'  Inserted: {code}')

# 2. Andrew Walker - assoc 235137 was Helen, so Andrew must be different
# Check all Walkers with Andrew
print('\n\nChecking all Andrew Walkers via AssociateDetails...')
# Try known Walker IDs from search
walker_ids_to_try = [163515, 233287, 226913, 234129, 233270, 233908, 199401, 231083, 232412, 227154]
for uid in walker_ids_to_try:
    d2 = get_details(uid)
    if d2 and d2.get('company_email'):
        print(f'  userid={uid}: email={d2["company_email"]}, assoc={d2["associate_id"]}')

# Also try searching "andreww"
import time
def search(term):
    r = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', params={
        'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1',
        'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'search': term,
    }, headers={'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://pod.planetaltig.com/'}, timeout=15)
    return r.json() if r.status_code == 200 else []

def extract_name(full_html):
    m = re.search(r'>([^<>]+?)\s*-\s*\d+\s*<', full_html)
    return m.group(1).strip() if m else re.sub(r'<[^>]+>', '', full_html).strip()

print('\nSearching "Walker" with all results:')
results = search('Walker')
print(f'  Total Walker results: {len(results)}')
for r in results:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]}, userId={r["UserId"]})')

# 3. Nicole Paul
print('\n\nAll Paul results:')
results3 = search('Paul')
print(f'  Total Paul results: {len(results3)}')
for r in results3:
    n = extract_name(r.get('FullName',''))
    print(f'  {n} (assoc={r["AssociateId"]}, userId={r["UserId"]})')
