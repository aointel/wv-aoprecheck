#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
import re

def fix_json_string(json_str):
    """Fix corrupted JSON strings by adding missing quotes"""
    if not json_str:
        return None
        
    # Fix common corruption: {First Name":"ARLIS" -> {"First Name":"ARLIS"
    json_str = re.sub(r'^{([^"]+)":', r'{"\1":', json_str)
    
    # Fix other common issues
    json_str = json_str.replace('\\"', '"')  # Fix escaped quotes
    json_str = json_str.replace("'", '"')    # Fix single quotes
    
    return json_str

def extract_client_data_from_csv():
    """Extract all possible client data from the CSV file"""
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194525624.csv"
    client_data = {}  # phone -> client info
    
    print("🔄 Extracting client data from CSV...")
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        processed = 0
        successful = 0
        
        for row in reader:
            processed += 1
            phone = (row.get('Phone', '') or '').strip()
            event = (row.get('Event', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            
            if not phone or not params:
                continue
                
            # Try to parse JSON with various fixes
            parsed_data = None
            
            # Try original first
            try:
                parsed_data = json.loads(params)
            except:
                # Try with JSON fixes
                try:
                    fixed_json = fix_json_string(params)
                    if fixed_json:
                        parsed_data = json.loads(fixed_json)
                except:
                    # Try manual extraction for badly corrupted JSON
                    try:
                        # Extract using regex patterns
                        leadid_match = re.search(r'"?Leadid"?\s*:\s*(\d+)', params)
                        fname_match = re.search(r'"?First Name"?\s*:\s*"([^"]+)"', params)
                        lname_match = re.search(r'"?Last Name"?\s*:\s*"([^"]+)"', params)
                        market_match = re.search(r'"?Market"?\s*:\s*"([^"]+)"', params)
                        
                        if leadid_match and fname_match and lname_match:
                            parsed_data = {
                                'Leadid': int(leadid_match.group(1)),
                                'First Name': fname_match.group(1),
                                'Last Name': lname_match.group(1),
                                'Market': market_match.group(1) if market_match else ''
                            }
                    except:
                        continue
            
            if parsed_data:
                leadid = str(parsed_data.get('Leadid', ''))
                firstname = parsed_data.get('First Name', '')
                lastname = parsed_data.get('Last Name', '')
                market = parsed_data.get('Market', '')
                
                if leadid and firstname and lastname:
                    client_data[phone] = {
                        'leadid': leadid,
                        'firstname': firstname,
                        'lastname': lastname,
                        'market': market
                    }
                    successful += 1
                    
                    if successful <= 10:  # Show first 10 for debugging
                        print(f"   ✅ {phone} → {firstname} {lastname} | Lead: {leadid} | Market: {market}")
    
    print(f"📊 Processed {processed} CSV rows")
    print(f"📊 Successfully extracted {successful} complete client records")
    return client_data

def get_database_connects():
    """Get all vdp_connects from database"""
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        ORDER BY duration_seconds DESC
    ''')
    
    connects = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"📊 Found {len(connects)} database connects")
    return connects

def create_complete_csv():
    """Create complete CSV with all available client data"""
    print("🔄 Creating complete VDP CSV with ALL client data...")
    
    # Extract client data from CSV
    client_data = extract_client_data_from_csv()
    
    # Get database connects
    db_connects = get_database_connects()
    
    # Create complete CSV
    csv_data = []
    matched_count = 0
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
        # Check if we have client data for this phone
        if db_phone in client_data:
            client = client_data[db_phone]
            csv_data.append({
                'Date': db_date if db_date else '',
                'PickupTime': db_time if db_time else '',
                'EndTime': db_time if db_time else '',
                'Duration': db_duration,
                'Agent': db_agent,
                'Phone': db_phone,
                'Leadid': client['leadid'],
                'Firstname': client['firstname'],
                'Lastname': client['lastname'],
                'Market': client['market']
            })
            matched_count += 1
        else:
            # No client data available
            csv_data.append({
                'Date': db_date if db_date else '',
                'PickupTime': db_time if db_time else '',
                'EndTime': db_time if db_time else '',
                'Duration': db_duration,
                'Agent': db_agent,
                'Phone': db_phone,
                'Leadid': '',
                'Firstname': '',
                'Lastname': '',
                'Market': ''
            })
    
    # Write the complete CSV
    with open('public/vdp_connects_complete_all.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created complete VDP CSV with {len(csv_data)} records")
    print(f"📊 {matched_count} records with complete client data")
    print(f"📊 {len(csv_data) - matched_count} records without client data")
    
    # Show top 10 complete records
    complete_only = [row for row in csv_data if row['Leadid']]
    complete_only.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print("\n🏆 TOP 10 COMPLETE CONNECTS WITH CLIENT DATA:")
    for i, row in enumerate(complete_only[:10]):
        print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']}")
    
    # Replace the main CSV
    print("\n🔄 Replacing main vdp_connects.csv with complete data...")
    import shutil
    shutil.copy('public/vdp_connects_complete_all.csv', 'public/vdp_connects.csv')
    print("✅ Replaced public/vdp_connects.csv with ALL complete client data")
    
    return len(complete_only), len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = create_complete_csv()
    print(f"\n📊 FINAL RESULTS:")
    print(f"   Total Records: {total_count}")
    print(f"   Complete Client Data: {complete_count}")
    print(f"   Missing Client Data: {total_count - complete_count}")
    print(f"   Success Rate: {(complete_count/total_count)*100:.1f}%")