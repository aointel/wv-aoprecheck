import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

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
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=15)
    if r.status_code != 200: return None
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    return {
        'associate_id': assoc_m.group(1) if assoc_m else None,
        'company_email': emails[0].lower() if emails else None,
    }

def sb_update_by_name(agent_name, patch):
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.{requests.utils.quote(agent_name)}&select=id',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
    )
    rows = resp.json()
    if rows:
        r = requests.patch(
            f'{SUPABASE_URL}/rest/v1/customers?id=eq.{rows[0]["id"]}',
            headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
            json=patch
        )
        return r.status_code
    return None

# Revert Nicole Paul - remove the wrong Spaulding data
print('Reverting Nicole Paul bad match...')
code = sb_update_by_name('Nicole Paul', {'associate_id': None, 'company_email': None})
print(f'  Reverted: {code}')

# Show ALL 235xxx results for each search to pick the right ones
print('\n=== All 235xxx results for "Walker" ===')
for r in search('Walker'):
    if str(r['AssociateId']).startswith('235'):
        print(f'  {extract_name(r.get("FullName",""))} assoc={r["AssociateId"]}')

print('\n=== All 235xxx results for "Paul" (last name must BE Paul) ===')
for r in search('Paul'):
    name = extract_name(r.get('FullName', ''))
    # Only match if Paul is actually the last name (format: "PAUL, firstname" or "firstname Paul")
    parts = re.sub(r'[,]', ' ', name).split()
    if 'PAUL' in [p.upper() for p in parts] and str(r['AssociateId']).startswith('235'):
        print(f'  {name} assoc={r["AssociateId"]}')

print('\n=== Also try searching "Nicole" for 235xxx ===')
for r in search('Nicole'):
    name = extract_name(r.get('FullName', ''))
    if str(r['AssociateId']).startswith('235'):
        print(f'  {name} assoc={r["AssociateId"]}')
