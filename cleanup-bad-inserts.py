import requests
import json

SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co'
SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'

# Load the results from the previous run
with open('csv-match-results.json') as f:
    data = json.load(f)

# Find all PARTIAL matches (wrong people)
headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}

partial_inserted = []
for r in data['found']:
    # Only keep exact matches where agent_name first+last matches csv_name first+last
    search_name = r['search_name'].upper()
    csv_name = r['csv_name'].upper()
    
    search_parts = search_name.split()
    csv_parts = csv_name.split()
    
    search_first = search_parts[0]
    search_last = search_parts[-1]
    csv_first = csv_parts[0] if csv_parts else ''
    csv_last = csv_parts[-1] if csv_parts else ''
    
    is_exact = (search_first == csv_first and search_last == csv_last)
    
    if not is_exact:
        partial_inserted.append(r)
        
print(f'Partial (wrong) matches to delete: {len(partial_inserted)}')

deleted = 0
kept = 0

for r in data['found']:
    search_name = r['search_name'].upper()
    csv_name = r['csv_name'].upper()
    
    search_parts = search_name.split()
    csv_parts = csv_name.split()
    search_first = search_parts[0]
    search_last = search_parts[-1]
    csv_first = csv_parts[0] if csv_parts else ''
    csv_last = csv_parts[-1] if csv_parts else ''
    
    is_exact = (search_first == csv_first and search_last == csv_last)
    
    assoc_id = r['associate_id']
    email = r['company_email']
    
    if not is_exact:
        # Delete the bad insert - match by agent_name (the search_name we stored)
        # We stored agent_name = search_name (first_name + last_name)
        search_first_lower = search_parts[0].lower().capitalize()
        search_last_lower = search_parts[-1].lower().capitalize()
        
        # Find by agent_name
        resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/customers?agent_name=eq.{requests.utils.quote(r["search_name"])}&select=id,agent_name,associate_id',
            headers=headers,
        )
        rows = resp.json()
        if isinstance(rows, list) and rows:
            for row in rows:
                del_resp = requests.delete(
                    f'{SUPABASE_URL}/rest/v1/customers?id=eq.{row["id"]}',
                    headers=headers,
                )
                if del_resp.status_code in (200, 204):
                    print(f'  DELETED: {r["search_name"]} (was mapped to {r["csv_name"]})')
                    deleted += 1
                else:
                    print(f'  DELETE FAILED: {r["search_name"]}: {del_resp.status_code} {del_resp.text[:100]}')
        else:
            print(f'  NOT FOUND to delete: {r["search_name"]}')
    else:
        print(f'  KEEPING exact match: {r["search_name"]} = {r["csv_name"]}')
        kept += 1

print(f'\nDeleted: {deleted}, Kept (exact): {kept}')
