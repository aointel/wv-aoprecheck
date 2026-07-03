import requests, re, sys, time
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
s.get('https://pod.planetaltig.com/')

MY_ASSOC = '231'

def get_details(user_id):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=10)
    if r.status_code != 200: return None
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    assoc_id = assoc_m.group(1) if assoc_m else None
    if not assoc_id or assoc_id == MY_ASSOC: return None
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    name_m = re.search(r'<h[12][^>]*>\s*([^<]{3,60})\s*</h[12]>', html)
    return {
        'associate_id': assoc_id,
        'company_email': emails[0].lower() if emails else None,
        'page_name': name_m.group(1).strip() if name_m else None,
    }

def sb_update(agent_name, patch):
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

# Fix Linda Scott -> assoc=235170, email=scottlinda@aoglobelife.com
print('Fixing Linda Scott...')
code = sb_update('Linda Scott', {'associate_id': 235170, 'company_email': 'scottlinda@aoglobelife.com'})
print(f'  Updated: {code}')

# Scan 235210-235500 for Walker and Paul
known = set(range(235100, 235210))  # already scanned
targets = list(range(235210, 235500))
print(f'\nScanning {len(targets)} IDs (235210-235499) for Walker/Paul...')

for uid in targets:
    d = get_details(uid)
    if d:
        name = (d.get('page_name') or '').upper()
        if 'WALKER' in name or 'PAUL' in name:
            print(f'  *** userid={uid}: assoc={d["associate_id"]} name={d["page_name"]} email={d["company_email"]}')
    time.sleep(0.05)

print('Done scanning.')
