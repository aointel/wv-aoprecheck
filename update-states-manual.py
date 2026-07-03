import csv, requests, sys
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'}

# Load CSV
with open(r'C:\Users\mmand\OneDrive\Documents\statelistbveacaum.csv', encoding='utf-8-sig') as f:
    rows = {row['Agent Name'].strip(): row for row in csv.DictReader(f)}

def get_states(row):
    return ', '.join(k for k, v in row.items() if k not in ('Agent Name', 'Total') and v.strip() in ('R', 'NR'))

def update_by_name(db_name, csv_name):
    states = get_states(rows[csv_name])
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/customers?agent_name=ilike.{requests.utils.quote(f"*{db_name.split()[0]}*{db_name.split()[-1]}*")}&select=id,agent_name',
        headers=headers)
    matches = resp.json()
    if not matches:
        print(f'  DB NOT FOUND: {db_name}')
        return
    r = requests.patch(
        f'{SUPABASE_URL}/rest/v1/customers?id=eq.{matches[0]["id"]}',
        headers=headers, json={'states': states})
    print(f'  {"✅" if r.status_code==204 else "❌"} {matches[0]["agent_name"]} -> {states}')

# Manual mappings: db_name -> csv_name
mappings = {
    'Carolina Jorge F Richmond': 'Carolina Jorge F Richmond, Mrs',
    'Robert Lee Jones': 'Robert Lee Jones, Iv',
}

for db_name, csv_name in mappings.items():
    if csv_name in rows:
        update_by_name(db_name, csv_name)
    else:
        print(f'CSV key not found: {csv_name}')
