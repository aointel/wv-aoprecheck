import csv, requests, sys, json
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'}

with open(r'C:\Users\mmand\OneDrive\Documents\statelistbveacaum.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

print(f'Loaded {len(rows)} agents from CSV\n')

updated = 0
not_found = []

for row in rows:
    agent_name = row['Agent Name'].strip()
    # Collect all licensed states (R or NR = licensed)
    states = [k for k, v in row.items() if k not in ('Agent Name', 'Total') and v.strip() in ('R', 'NR')]
    if not states:
        continue

    states_str = ', '.join(states)

    # Find in customers by agent_name (fuzzy: match first + last)
    parts = agent_name.split()
    first, last = parts[0], parts[-1]

    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?first_name=ilike.{requests.utils.quote(first)}&last_name=ilike.{requests.utils.quote(last)}&select=id,agent_name,states',
        headers=headers
    )
    matches = resp.json()

    if not matches:
        # Try by agent_name exact
        resp2 = requests.get(
            f'{SUPABASE_URL}/rest/v1/customers?agent_name=ilike.{requests.utils.quote(f"*{first}*{last}*")}&select=id,agent_name,states',
            headers=headers
        )
        matches = resp2.json()

    if not matches:
        not_found.append(agent_name)
        print(f'  NOT FOUND: {agent_name}')
        continue

    row_id = matches[0]['id']
    patch = requests.patch(
        f'{SUPABASE_URL}/rest/v1/customers?id=eq.{row_id}',
        headers=headers,
        json={'states': states_str}
    )
    if patch.status_code == 204:
        print(f'  ✅ {agent_name} -> {states_str}')
        updated += 1
    else:
        print(f'  ❌ {agent_name}: {patch.status_code} {patch.text[:100]}')

print(f'\nUpdated: {updated}, Not found: {len(not_found)}')
if not_found:
    print('Not found:')
    for n in not_found:
        print(f'  - {n}')
