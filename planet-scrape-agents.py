import requests
import re
import json
import time
import sys

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
    # Get login page for CSRF token
    r = s.get('https://pod.planetaltig.com/Account/Login')
    # Extract request verification token if present
    token_match = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', r.text)
    payload = {'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}
    if token_match:
        payload['__RequestVerificationToken'] = token_match.group(1)
    r2 = s.post('https://pod.planetaltig.com/Account/Login', data=payload, allow_redirects=True)
    print(f"Login status: {r2.status_code}, URL: {r2.url}")
    return s

def search_agent(s, first_name, last_name):
    """Try multiple search strategies to find an agent on planet."""
    
    # Strategy 1: Search page with lastName param
    urls_to_try = [
        f'https://pod.planetaltig.com/Associates?lastName={requests.utils.quote(last_name)}&firstName={requests.utils.quote(first_name)}',
        f'https://pod.planetaltig.com/Associates?search={requests.utils.quote(last_name)}',
        f'https://pod.planetaltig.com/Associates?q={requests.utils.quote(last_name)}',
        f'https://pod.planetaltig.com/Associates?name={requests.utils.quote(last_name)}',
    ]
    
    for url in urls_to_try:
        r = s.get(url, timeout=15)
        content = r.text
        # Look for associate detail links
        detail_links = re.findall(r'href="[^"]*AssociateDetails[^"]*[?&]u=([^"&\s]+)"', content, re.IGNORECASE)
        if detail_links:
            print(f"  Found {len(detail_links)} detail link(s) via {url.split('?')[1][:40]}")
            # If multiple results, try to match by name
            for alias in detail_links[:5]:  # check up to 5
                details = get_details(s, alias)
                if details:
                    dn = (details.get('page_name') or '').upper()
                    if last_name.upper() in dn or first_name.upper() in dn:
                        return details
            # Return first if we can't narrow down
            return get_details(s, detail_links[0])
    
    # Strategy 2: Try direct alias guess (firstname + lastname)
    alias_guess = f"{first_name.lower()}{last_name.lower()}"
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?u={alias_guess}', timeout=15)
    if r.status_code == 200 and 'AssociateDetails' in r.url and last_name.upper() in r.text.upper():
        return parse_details(r.text, alias_guess)
    
    return None

def get_details(s, alias):
    r = s.get(f'https://pod.planetaltig.com/AssociateDetails?u={alias}', timeout=15)
    if r.status_code != 200:
        return None
    return parse_details(r.text, alias)

def parse_details(html, alias):
    # Strip HTML helper
    def strip(s):
        return re.sub(r'<[^>]+>', '', s).strip()
    
    # Extract all th/td pairs
    fields = {}
    for th, td in re.findall(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE):
        k = strip(th).lower().strip(':').strip()
        v = strip(td).strip()
        if k and v:
            fields[k] = v
    
    # Try various field names for associate ID
    assoc_id = None
    for key in ['associate id', 'associate #', 'associate number', 'associateid', 'id', 'associate']:
        if key in fields and re.match(r'^\d+$', fields[key].replace(',','')):
            assoc_id = fields[key].replace(',','')
            break
    
    # Fallback: search for any number that looks like associate ID in page
    if not assoc_id:
        m = re.search(r'AssociateID[^>]*>([0-9]+)', html) or \
            re.search(r'Associate(?:\s*ID|#)[^<]*?([0-9]{4,7})', html, re.IGNORECASE)
        if m:
            assoc_id = m.group(1)
    
    # Extract email
    company_email = None
    # Look for aoglobelife.com email
    emails = re.findall(r'[\w.%+\-]+@aoglobelife\.com', html, re.IGNORECASE)
    if emails:
        company_email = emails[0].lower()
    else:
        # Try any email in email-looking fields
        for key in ['company email', 'email', 'work email', 'business email']:
            if key in fields and '@' in fields[key]:
                company_email = fields[key]
                break
    
    # Extract name
    name_match = re.search(r'<h[12][^>]*>\s*([^<]{5,80})\s*</h[12]>', html, re.IGNORECASE)
    page_name = name_match.group(1).strip() if name_match else None
    
    # Also try the page title
    if not page_name:
        title_match = re.search(r'<title>([^<]+)</title>', html, re.IGNORECASE)
        if title_match:
            page_name = title_match.group(1).strip()
    
    return {
        'alias': alias,
        'associate_id': assoc_id,
        'company_email': company_email,
        'page_name': page_name,
        'all_fields': fields,
    }

def sb_insert(row):
    r = requests.post(
        f'{SUPABASE_URL}/rest/v1/customers',
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        json=row
    )
    return r.status_code, r.text

def sb_check_exists(associate_id, company_email):
    filters = []
    if associate_id:
        filters.append(f'associate_id=eq.{associate_id}')
    if company_email:
        filters.append(f'company_email=eq.{requests.utils.quote(company_email)}')
    if not filters:
        return False
    r = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?or=({",".join(filters)})&select=id&limit=1',
        headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
    )
    data = r.json()
    return isinstance(data, list) and len(data) > 0

def main():
    print("=== Planet Agent Scraper ===\n")
    s = login()
    
    results = []
    failed = []
    
    for i, name in enumerate(NAMES):
        parts = name.split(' ')
        first = parts[0]
        last = parts[-1]
        
        print(f"[{i+1}/{len(NAMES)}] {name} (searching '{first}' '{last}')...")
        try:
            data = search_agent(s, first, last)
            if data and (data.get('associate_id') or data.get('company_email')):
                print(f"  ✅ assoc_id={data['associate_id']}, email={data['company_email']}, page_name={data['page_name']}")
                results.append({'name': name, **data})
            else:
                print(f"  ❌ Not found")
                if data:
                    print(f"     fields found: {list(data.get('all_fields',{}).keys())[:10]}")
                failed.append(name)
        except Exception as e:
            print(f"  ❌ Error: {e}")
            failed.append(name)
        
        time.sleep(0.3)
    
    print(f"\n=== DONE: {len(results)} found, {len(failed)} failed ===")
    
    # Save results to JSON for review
    with open('planet-agent-results.json', 'w', encoding='utf-8') as f:
        json.dump({'found': results, 'failed': failed}, f, indent=2)
    print("Results saved to planet-agent-results.json")
    
    # Insert into Supabase
    inserted = 0
    skipped = 0
    errors = 0
    
    for r in results:
        name = r['name']
        parts = name.split(' ')
        first_name = parts[0]
        last_name = parts[-1]
        
        assoc_id = int(r['associate_id']) if r['associate_id'] and r['associate_id'].isdigit() else None
        email = r['company_email']
        
        # Check if exists
        if sb_check_exists(assoc_id, email):
            print(f"  SKIP (exists): {name}")
            skipped += 1
            continue
        
        row = {
            'first_name': first_name,
            'last_name': last_name,
            'agent_name': name,
            'associate_id': assoc_id,
            'company_email': email,
            'status': 'active',
        }
        
        status, resp = sb_insert(row)
        if status in (200, 201):
            print(f"  ✅ Inserted: {name} (assoc={assoc_id}, email={email})")
            inserted += 1
        else:
            print(f"  ❌ Insert failed for {name}: {status} {resp[:200]}")
            errors += 1
    
    print(f"\nInserted: {inserted}, Skipped: {skipped}, Errors: {errors}")
    print(f"Failed to find on planet: {len(failed)}")
    if failed:
        for n in failed:
            print(f"  - {n}")

if __name__ == '__main__':
    main()
