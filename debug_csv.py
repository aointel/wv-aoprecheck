#!/usr/bin/env python3
import csv
import json

# Test CSV parsing
csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757193655163.csv"

phone_lookup = {}
count = 0

with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        count += 1
        if count <= 5:  # Debug first 5 rows
            print(f"Row {count}:")
            print(f"  Phone: '{row.get('Phone', 'MISSING')}' (type: {type(row.get('Phone'))})")
            print(f"  Params: '{row.get('Params', 'MISSING')[:50]}...'")
            
            phone = (row['Phone'] or '').strip()
            params = (row['Params'] or '').strip()
            
            print(f"  After cleanup - Phone: '{phone}', Has params: {bool(params)}")
            
            if phone and params:
                try:
                    params_data = json.loads(params)
                    leadid = params_data.get('Leadid', '')
                    firstname = params_data.get('First Name', '')
                    lastname = params_data.get('Last Name', '')
                    market = params_data.get('Market', '')
                    print(f"  Client data: {firstname} {lastname}, Lead: {leadid}, Market: {market}")
                    
                    if leadid:
                        phone_lookup[phone] = {
                            'leadid': str(leadid),
                            'firstname': firstname,
                            'lastname': lastname,
                            'market': market
                        }
                        print(f"  ✅ Added to lookup!")
                    else:
                        print(f"  ❌ No leadid found")
                        
                except Exception as e:
                    print(f"  ❌ JSON parse error: {e}")
            else:
                print(f"  ❌ Missing phone or params")
            print()

print(f"Total rows processed: {count}")
print(f"Phone lookup entries: {len(phone_lookup)}")

# Show first few entries
if phone_lookup:
    print("First few phone lookup entries:")
    for i, (phone, data) in enumerate(list(phone_lookup.items())[:3]):
        print(f"  {phone} → {data['firstname']} {data['lastname']} (Lead: {data['leadid']})")
else:
    print("❌ NO PHONE LOOKUP ENTRIES FOUND!")