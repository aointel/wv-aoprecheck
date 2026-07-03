import requests, re, sys, json, time
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

# Load scrape-final-results.json to see what was not found
with open('scrape-final-results.json') as f:
    prev = json.load(f)

NOT_FOUND = [n['name'] for n in prev['not_found']]
print(f'Retrying {len(NOT_FOUND)} agents\n')

def login():
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
    s.get('https://pod.planetaltig.com/')
    return s

def search(s, term):
    resp = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', params={
        'showterminatedonly': 'false', 'officeID': '0', 'contextID': '1',
        'searchByAgentNumber': 'false', 'searchByPhoneNumber': 'false', 'search': term,
    }, headers={'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://pod.planetaltig.com/'}, timeout=15)
    if resp.status_code == 200:
        return resp.json()
    return []

def extract_name(full_html):
    m = re.search(r'>([^<>]+?)\s*-\s*\d+\s*<', full_html)
    if m:
        return m.group(1).strip()
    return re.sub(r'<[^>]+>', '', full_html).strip()

def get_details(s, user_id):
    resp = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=15)
    if resp.status_code != 200:
        return None
    html = resp.text
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    phone_m = re.search(r'(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4})', html)
    mga_m = re.search(r'Executive Producer</th>\s*<td[^>]*>([^<]+)</td>', html, re.IGNORECASE)
    return {
        'associate_id': assoc_m.group(1) if assoc_m else None,
        'company_email': emails[0].lower() if emails else None,
        'phone': phone_m.group(1) if phone_m else None,
        'mga': mga_m.group(1).strip() if mga_m else None,
    }

def normalize(s):
    return re.sub(r'[^a-z]', '', s.lower())

def sb_insert(row):
    resp = requests.post(f'{SUPABASE_URL}/rest/v1/customers', headers={
        'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
    }, json=row)
    return resp.status_code, resp.text

def sb_check_exists(assoc_id, email):
    filters = []
    if assoc_id:
        filters.append(f'associate_id=eq.{assoc_id}')
    if email:
        filters.append(f'company_email=eq.{requests.utils.quote(email)}')
    if not filters:
        return False
    resp = requests.get(f'{SUPABASE_URL}/rest/v1/customers?or=({",".join(filters)})&select=id&limit=1',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
    data = resp.json()
    return isinstance(data, list) and len(data) > 0

def main():
    s = login()
    
    found = []
    still_not_found = []
    
    for name in NOT_FOUND:
        parts = name.split()
        first = parts[0]
        last = parts[-1]
        # Middle words (excluding single-letter initials)
        middles = [p for p in parts[1:-1] if len(p) > 1]
        
        print(f'\n--- {name} ---')
        norm_first = normalize(first)
        norm_last = normalize(last)
        
        match = None
        
        # Strategy 1: search by first name, check for last name match
        for search_term in [first, last] + middles:
            results = search(s, search_term)
            for r in results:
                full_name = extract_name(r.get('FullName', ''))
                norm_full = normalize(full_name)
                if norm_last in norm_full and norm_first in norm_full:
                    match = r
                    print(f'  ✅ Found via "{search_term}": {full_name} (assoc={r["AssociateId"]})')
                    break
            if match:
                break
            time.sleep(0.1)
        
        # Strategy 2: search by partial last name variants
        if not match:
            # Try stripping hyphens and compound names
            clean_last = re.sub(r'[-]', '', last)
            for term in [clean_last, last.replace('-', ' ').split()[0], last.replace('-', ' ').split()[-1]]:
                if term != last:
                    results = search(s, term)
                    for r in results:
                        full_name = extract_name(r.get('FullName', ''))
                        norm_full = normalize(full_name)
                        if (norm_last in norm_full or normalize(term) in norm_full) and norm_first in norm_full:
                            match = r
                            print(f'  ✅ Found via variant "{term}": {full_name} (assoc={r["AssociateId"]})')
                            break
                    if match:
                        break
                    time.sleep(0.1)
        
        # Strategy 3: search full name as one string
        if not match:
            for combo in [f'{first} {last}', f'{last} {first}', f'{first}{last}']:
                results = search(s, combo[:20])
                for r in results:
                    full_name = extract_name(r.get('FullName', ''))
                    norm_full = normalize(full_name)
                    if norm_last in norm_full or norm_first in norm_full:
                        if norm_last in norm_full and norm_first in norm_full:
                            match = r
                            print(f'  ✅ Found via combo "{combo[:20]}": {full_name} (assoc={r["AssociateId"]})')
                            break
                if match:
                    break
                time.sleep(0.1)
        
        # Show all results for manual review if still not found
        if not match:
            print(f'  ❌ Not found. Showing all results for last name "{last}":')
            results = search(s, last)
            for r in results[:10]:
                print(f'     {extract_name(r.get("FullName",""))} (assoc={r["AssociateId"]})')
            results2 = search(s, first)
            print(f'  All results for first name "{first}":')
            for r in results2[:10]:
                print(f'     {extract_name(r.get("FullName",""))} (assoc={r["AssociateId"]})')
            still_not_found.append(name)
        else:
            details = get_details(s, match['UserId'])
            found.append({
                'name': name,
                'planet_name': extract_name(match.get('FullName', '')),
                'associate_id': (details or {}).get('associate_id') or str(match['AssociateId']),
                'company_email': (details or {}).get('company_email'),
                'phone': (details or {}).get('phone'),
                'mga': (details or {}).get('mga'),
            })
        time.sleep(0.2)
    
    print(f'\n=== Remainder: {len(found)} found, {len(still_not_found)} still missing ===')
    
    # Insert
    inserted = 0
    skipped = 0
    errors = 0
    for r in found:
        name = r['name']
        parts = name.split()
        assoc_id = r['associate_id']
        email = r['company_email']
        if sb_check_exists(assoc_id, email):
            print(f'  SKIP (exists): {name}')
            skipped += 1
            continue
        row = {
            'first_name': parts[0], 'last_name': parts[-1], 'agent_name': name, 'status': 'active',
        }
        if assoc_id and str(assoc_id).isdigit():
            row['associate_id'] = int(assoc_id)
        if email:
            row['company_email'] = email
        if r.get('phone'):
            row['phone'] = r['phone']
        code, resp_text = sb_insert(row)
        if code in (200, 201):
            print(f'  ✅ Inserted: {name} (assoc={assoc_id}, email={email})')
            inserted += 1
        else:
            print(f'  ❌ Failed: {name}: {code} {resp_text[:150]}')
            errors += 1
    
    print(f'\nInserted={inserted}, Skipped={skipped}, Errors={errors}')
    print(f'\nStill not found ({len(still_not_found)}):')
    for n in still_not_found:
        print(f'  - {n}')

if __name__ == '__main__':
    main()
