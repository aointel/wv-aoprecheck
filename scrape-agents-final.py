import requests, re, sys, json, time
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

NAMES = [
    "Aaron G Lawrence","Aaron Lowell Stander","Adaisha Darby","Alexandra Dominguez",
    "Amari J Kerr","Amy Jewell Beauchamp","Amy Jo Knight Commander","Andrew Walker",
    "Anthony Greco","Ashley Nicole Gamache","Aubrey Wolfe","Austin Wayne Smith",
    "Boris Koprivica","Brandon Quinn Cabeceiras","Bruce L Moxley","Camila Dalbem Andrade",
    "Carolina Jorge F Richmond","Cathleen Hairston","Christian Samuel Mercado",
    "Christina-Maria Mapuana Anna Altvater","Colby Devon Richards","Craig Stasiowski",
    "Cynthia Schomp","Dawid Liniewski","Dontaeja Smart","Drew Thomas Sharp",
    "Eleanor Rose Giles","Eric Geiss","Felipe R Machado Santanna","Fidel R Escobar",
    "Gabriel Arsene De Souza","George Carl Tockstein","Helen Bradley","Hortensia Angel Joseph",
    "Jakeline Ferreira Campos Olive","Janice Nicole Badger","Jiael Zenia Astwood",
    "Jonathan Angel Cantu","Jonathan Carrero","Junia Williams","Justin Zeramby",
    "Kaitlyn Lorraine Tuckmantel","Kendall Rena Grewer","Kimberly D Alston",
    "Kristian Portante","Krystal K Redding","Kyra Hopkins","Kywan Gilbert Jasper Sheppard",
    "Lalitha Janardhanan","Linda Scott","Lisa Yvette Smithson","Lleison Martinez",
    "Lynell Dominic Collier","Madison Smith","Matheus Bob","Michael N Locke",
    "Michael Ryan Shepler","Mistie Clontz Cockman","Monica Leticia Pina De Barros",
    "Natalia Lopes Monteiro","Nicholas Paul Triantafyllidis","Nicholas Walker",
    "Nicole Renee Paul","Nicolette Van Rensburg","Nikolaus Walter","Nivea Shanice Bryan",
    "Nolangie Rosado Pabon","Pallavi Varshney","Pamela Sue Faircloth","Paul Michael Demeo",
    "Philip Prata","Renata Johnson","Robert Gilman","Robert Lee Jones",
    "Rodney Jones","Ryan Wilson","Samantha P Nowak","Samuel Donadio",
    "Sean Gregory Melaven","Sean Hansen","Sergio D Vincenti","Sophia Limonciello",
    "Terrelle L Goslee-Adams","Teshaun Devoise","Theresa Jo Bryson","Timothy Matthew Wilson",
    "Towanya Thompson","Treyson Scott","Tyran Carter","Vitor Ingles Buche",
    "William Frederick Lawson","Yaury Victoria","Zaki Blanding"
]

def login():
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})
    s.get('https://pod.planetaltig.com/')  # initialize session
    return s

def autocomplete_search(s, search_term):
    """Search autocomplete, return list of {AssociateId, UserId, FullName}"""
    resp = s.get('https://pod.planetaltig.com/Home/AutoCompleteAssociateHierarchy', params={
        'showterminatedonly': 'false',
        'officeID': '0',
        'contextID': '1',
        'searchByAgentNumber': 'false',
        'searchByPhoneNumber': 'false',
        'search': search_term,
    }, headers={
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://pod.planetaltig.com/',
    }, timeout=15)
    if resp.status_code == 200:
        return resp.json()
    return []

def extract_name_from_full(full_html):
    """Extract clean name from FullName HTML like: '...BLANDING, ZAKI - 235128'"""
    m = re.search(r'>([^<>]+?)\s*-\s*\d+\s*<', full_html)
    if m:
        return m.group(1).strip()
    # Fallback: strip tags
    clean = re.sub(r'<[^>]+>', '', full_html).strip()
    m2 = re.search(r'([A-Za-z][^-]+?)\s*-\s*\d+', clean)
    if m2:
        return m2.group(1).strip()
    return clean

def normalize(s):
    return re.sub(r'[^a-z]', '', s.lower())

def get_details(s, user_id):
    """Get associate details page for userid"""
    resp = s.get(f'https://pod.planetaltig.com/AssociateDetails?userid={user_id}&includeterminated=false', timeout=15)
    if resp.status_code != 200:
        return None
    html = resp.text
    
    assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
    assoc_id = assoc_m.group(1) if assoc_m else None
    
    emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
    email = emails[0].lower() if emails else None
    
    # Also get personal email
    personal_emails = re.findall(r'[a-zA-Z0-9._%+\-]+@(?!aoglobelife)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', html)
    
    # Get phone
    phone_m = re.search(r'(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4})', html)
    phone = phone_m.group(1) if phone_m else None
    
    # Get MGA
    mga_m = re.search(r'Executive Producer</th>\s*<td[^>]*>([^<]+)</td>', html, re.IGNORECASE)
    mga = mga_m.group(1).strip() if mga_m else None
    
    return {
        'associate_id': assoc_id,
        'company_email': email,
        'phone': phone,
        'mga': mga,
    }

def sb_check_exists(s_client, associate_id, company_email):
    filters = []
    if associate_id:
        filters.append(f'associate_id=eq.{associate_id}')
    if company_email:
        filters.append(f'company_email=eq.{requests.utils.quote(company_email)}')
    if not filters:
        return False
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?or=({",".join(filters)})&select=id&limit=1',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
    )
    data = resp.json()
    return isinstance(data, list) and len(data) > 0

def sb_insert(row):
    resp = requests.post(
        f'{SUPABASE_URL}/rest/v1/customers',
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        json=row
    )
    return resp.status_code, resp.text

def main():
    print('=== Planet Agent Scraper (Autocomplete) ===\n')
    s = login()
    print('Logged in.\n')
    
    found = []
    not_found = []
    
    for i, name in enumerate(NAMES):
        parts = name.split()
        first = parts[0]
        last = parts[-1]
        
        print(f'[{i+1}/{len(NAMES)}] {name}...')
        
        # Search by last name
        results = autocomplete_search(s, last)
        
        # If none found, try first name
        if not results:
            results = autocomplete_search(s, first)
        
        # If still none, try partial last name (for compound names)
        if not results and len(last) > 5:
            results = autocomplete_search(s, last[:5])
        
        # Match by first name
        norm_first = normalize(first)
        norm_last = normalize(last)
        
        match = None
        for r in results:
            full_name = extract_name_from_full(r.get('FullName', ''))
            # Planet format is "LAST, FIRST" or "FIRSTNAME LASTNAME"
            norm_full = normalize(full_name)
            
            # Check if both first and last name appear
            if norm_last in norm_full and norm_first in norm_full:
                match = r
                print(f'  ✅ Exact match: {full_name} (AssociateId={r["AssociateId"]})')
                break
            # Check last name only + first name initial
            if norm_last in norm_full and norm_first[0] == normalize(full_name.split()[0] if full_name.split() else '')[0:1]:
                if not match:
                    match = r
        
        # If still no match with last name, try first name search
        if not match:
            results2 = autocomplete_search(s, first)
            for r in results2:
                full_name = extract_name_from_full(r.get('FullName', ''))
                norm_full = normalize(full_name)
                if norm_last in norm_full and norm_first in norm_full:
                    match = r
                    print(f'  ✅ Match via first name search: {full_name} (AssociateId={r["AssociateId"]})')
                    break
        
        if not match and results:
            print(f'  ⚠️ {len(results)} results for "{last}", none matched "{first}":')
            for r in results[:5]:
                print(f'     {extract_name_from_full(r.get("FullName",""))}')
            not_found.append({'name': name, 'reason': f'{len(results)} results, no first match'})
        elif not match:
            print(f'  ❌ Not found on planet')
            not_found.append({'name': name, 'reason': 'no results'})
        
        if match:
            # Get full details from AssociateDetails
            details = get_details(s, match['UserId'])
            if details:
                found.append({
                    'name': name,
                    'planet_name': extract_name_from_full(match.get('FullName', '')),
                    'associate_id': details['associate_id'] or str(match['AssociateId']),
                    'company_email': details['company_email'],
                    'phone': details['phone'],
                    'mga': details['mga'],
                })
            else:
                found.append({
                    'name': name,
                    'planet_name': extract_name_from_full(match.get('FullName', '')),
                    'associate_id': str(match['AssociateId']),
                    'company_email': None,
                    'phone': None,
                    'mga': None,
                })
        
        time.sleep(0.2)
    
    print(f'\n=== Found: {len(found)}, Not found: {len(not_found)} ===')
    
    with open('scrape-final-results.json', 'w', encoding='utf-8') as f:
        json.dump({'found': found, 'not_found': not_found}, f, indent=2)
    print('Saved to scrape-final-results.json')
    
    # Insert into Supabase
    inserted = 0
    skipped = 0
    errors = 0
    
    for r in found:
        name = r['name']
        parts = name.split()
        first_name = parts[0]
        last_name = parts[-1]
        assoc_id = r['associate_id']
        email = r['company_email']
        
        if sb_check_exists(None, assoc_id, email):
            print(f'  SKIP (exists): {name}')
            skipped += 1
            continue
        
        row = {
            'first_name': first_name,
            'last_name': last_name,
            'agent_name': name,
            'status': 'active',
        }
        if assoc_id and str(assoc_id).isdigit():
            row['associate_id'] = int(assoc_id)
        if email:
            row['company_email'] = email
        if r.get('phone'):
            row['phone'] = r['phone']
        if r.get('mga'):
            row['mga'] = r['mga']
        
        code, resp_text = sb_insert(row)
        if code in (200, 201):
            print(f'  ✅ Inserted: {name} (assoc={assoc_id}, email={email})')
            inserted += 1
        else:
            print(f'  ❌ Failed: {name}: {code} {resp_text[:150]}')
            errors += 1
    
    print(f'\n=== Insert results: inserted={inserted}, skipped={skipped}, errors={errors} ===')
    print(f'Not found on planet ({len(not_found)}):')
    for nf in not_found:
        print(f'  - {nf["name"]} ({nf["reason"]})')

if __name__ == '__main__':
    main()
