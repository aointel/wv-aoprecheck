import csv
import re
import sys
import json
import requests

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

# Load the Producer List CSV
csv_rows = []
for csv_file in ['Producer List 1.2.26.csv', 'Producer List 10.24.25.csv']:
    try:
        with open(csv_file, encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            csv_rows.extend(rows)
            print(f'Loaded {len(rows)} rows from {csv_file}')
    except Exception as e:
        print(f'Could not load {csv_file}: {e}')

print(f'Total CSV rows: {len(csv_rows)}')
if csv_rows:
    print('Columns:', list(csv_rows[0].keys())[:6])

def normalize(s):
    return re.sub(r'[^a-z]', '', (s or '').lower())

def name_to_parts(name):
    parts = name.strip().split()
    first = parts[0]
    last = parts[-1]
    # Also build middle initials if present
    return first, last, ' '.join(parts)

# Build lookup index from CSV (by last name)
from collections import defaultdict
last_name_index = defaultdict(list)
for row in csv_rows:
    agent = row.get('Agent', '').strip()
    if agent:
        parts = agent.split()
        if parts:
            last = normalize(parts[-1])
            last_name_index[last].append(row)

found = []
not_found = []

for name in NAMES:
    first, last, full = name_to_parts(name)
    norm_last = normalize(last)
    norm_first = normalize(first)
    
    candidates = last_name_index.get(norm_last, [])
    
    # Try to match by first + last
    match = None
    for row in candidates:
        agent = row.get('Agent', '').strip().upper()
        # Check if first name matches
        if norm_first in normalize(agent):
            match = row
            break
    
    if not match and candidates:
        # Just take first candidate with same last name
        match = candidates[0]
        print(f'  [PARTIAL] {name} -> {match.get("Agent")} (last name only match)')
    
    if match:
        assoc_id = match.get('Associate ID', '').strip()
        email = match.get('Company Email', '').strip()
        agent_name = match.get('Agent', '').strip()
        found.append({
            'search_name': name,
            'csv_name': agent_name,
            'associate_id': assoc_id,
            'company_email': email,
            'row': match,
        })
        print(f'  ✅ {name} -> {agent_name} | assoc={assoc_id} | email={email}')
    else:
        not_found.append(name)

print(f'\n=== Results: {len(found)} found, {len(not_found)} not found ===')
print('\nNot found:')
for n in not_found:
    print(f'  - {n}')

# Save results
with open('csv-match-results.json', 'w') as f:
    json.dump({'found': found, 'not_found': not_found}, f, indent=2, default=str)
print('\nSaved to csv-match-results.json')

# Now insert found ones into Supabase customers
print('\n=== Inserting into Supabase customers ===')
inserted = 0
skipped = 0
errors = 0

for r in found:
    name = r['search_name']
    parts = name.split()
    first_name = parts[0]
    last_name = parts[-1]
    
    assoc_id = r['associate_id']
    email = r['company_email']
    
    if not assoc_id and not email:
        print(f'  SKIP (no data): {name}')
        skipped += 1
        continue
    
    # Check if exists
    filters = []
    if assoc_id:
        filters.append(f'associate_id=eq.{assoc_id}')
    if email:
        filters.append(f'company_email=eq.{requests.utils.quote(email)}')
    
    if filters:
        check_resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/customers?or=({",".join(filters)})&select=id&limit=1',
            headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'},
        )
        existing = check_resp.json()
        if isinstance(existing, list) and len(existing) > 0:
            print(f'  SKIP (exists): {name} (assoc={assoc_id})')
            skipped += 1
            continue
    
    # Build row
    row = {
        'first_name': first_name,
        'last_name': last_name,
        'agent_name': name,
        'status': 'active',
    }
    if assoc_id and assoc_id.isdigit():
        row['associate_id'] = int(assoc_id)
    if email:
        row['company_email'] = email.lower()
    
    # Also include extra fields from CSV
    csv_row = r['row']
    if csv_row.get('AOI MARKET'):
        row['aoi_market'] = csv_row['AOI MARKET']
    if csv_row.get('AO Market 2'):
        row['ao_market_2'] = csv_row['AO Market 2']
    if csv_row.get('Personal Email'):
        row['personal_email'] = csv_row['Personal Email']
    if csv_row.get('Phone'):
        row['phone'] = csv_row['Phone']
    if csv_row.get('Life-and-Health Licensed States'):
        row['life_and_health_states'] = csv_row['Life-and-Health Licensed States']
    
    insert_resp = requests.post(
        f'{SUPABASE_URL}/rest/v1/customers',
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        json=row
    )
    
    if insert_resp.status_code in (200, 201):
        print(f'  ✅ Inserted: {name} -> {r["csv_name"]} (assoc={assoc_id}, email={email})')
        inserted += 1
    else:
        print(f'  ❌ Insert failed for {name}: {insert_resp.status_code} {insert_resp.text[:200]}')
        errors += 1

print(f'\n=== DONE: inserted={inserted}, skipped={skipped}, errors={errors} ===')
print(f'Not found in CSV: {len(not_found)}')
