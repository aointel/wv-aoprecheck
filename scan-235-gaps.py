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
    if not assoc_id or assoc_id == MY_ASSOC:
        return None
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    name_m = re.search(r'<h[12][^>]*>\s*([^<]{3,60})\s*</h[12]>', html)
    return {
        'associate_id': assoc_id,
        'company_email': emails[0].lower() if emails else None,
        'page_name': name_m.group(1).strip() if name_m else None,
    }

# Known occupied IDs from this batch
known = {
    235122,235123,235124,235126,235127,235128,235129,235130,235131,235132,
    235133,235134,235135,235136,235137,235138,235139,235141,235142,235143,
    235144,235145,235146,235147,235148,235149,235150,235151,235152,235154,
    235156,235157,235158,235160,235161,235162,235165,235168,235169,235171,
    235172,235174,235175,235176,235177,235178,235179,235180,235181,235184,
    235186,235188,235189,235192,235195,235197,235198,
    # also found
    235155, 235383, 236181, 236195, 236196, 236243,
}

# Scan the gaps in 235100-235210
targets = [uid for uid in range(235100, 235210) if uid not in known]
print(f'Scanning {len(targets)} gap IDs in 235100-235210...\n')

found_new = []
for uid in targets:
    d = get_details(uid)
    if d:
        print(f'  userid={uid}: assoc={d["associate_id"]} name={d["page_name"]} email={d["company_email"]}')
        found_new.append({**d, 'user_id': uid})
    time.sleep(0.05)

print(f'\nFound {len(found_new)} new records in gap IDs')
print('\nLooking for Walker and Paul...')
for r in found_new:
    name = (r.get('page_name') or '').upper()
    if 'WALKER' in name or 'PAUL' in name:
        print(f'  *** {r}')
