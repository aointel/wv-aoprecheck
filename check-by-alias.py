import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

MY_ASSOC = '231'

def check_alias(alias):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?u={alias}', timeout=10)
    html = r.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    assoc_id = assoc_m.group(1) if assoc_m else None
    if not assoc_id or assoc_id == MY_ASSOC:
        return None
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
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
    rows = resp.json()
    if rows:
        r = requests.patch(f'{SUPABASE_URL}/rest/v1/customers?id=eq.{rows[0]["id"]}',
            headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
            json=patch)
        return r.status_code
    return None

targets = [
    ('Andrew Walker', ['andrewwalker', 'awalker', 'walkerandrew']),
    ('Nicole Paul',   ['nicolepaul', 'nicolep', 'paulnicole']),
]

for agent_name, aliases in targets:
    print(f'\n=== {agent_name} ===')
    for alias in aliases:
        d = check_alias(alias)
        if d:
            print(f'  HIT: alias={alias} assoc={d["associate_id"]} name={d["page_name"]} email={d["company_email"]}')
            code = sb_update(agent_name, {'associate_id': int(d['associate_id']), 'company_email': d['company_email']})
            print(f'  DB updated: {code}')
            break
        else:
            print(f'  miss: {alias}')
