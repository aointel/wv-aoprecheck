#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
import re

def extract_all_complete_client_data():
    """Extract client data from complete JSON patterns in CSV"""
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194525624.csv"
    client_data = {}  # phone -> client info
    
    print("🔄 Extracting ALL complete client data from CSV...")
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        processed = 0
        successful = 0
        
        for row in reader:
            processed += 1
            phone = (row.get('Phone', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            
            if not phone or not params:
                continue
                
            # Look for complete JSON patterns
            if '"Market":' in params and '"Leadid":' in params and '"First Name":' in params and '"Last Name":' in params:
                try:
                    # Try to parse the complete JSON
                    parsed_data = json.loads(params)
                    
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
                        
                        if successful <= 20:  # Show first 20 for verification
                            print(f"   ✅ {phone} → {firstname} {lastname} | Lead: {leadid} | Market: {market}")
                
                except json.JSONDecodeError:
                    # Try manual regex extraction if JSON parsing fails
                    try:
                        leadid_match = re.search(r'"Leadid":(\d+)', params)
                        fname_match = re.search(r'"First Name":"([^"]+)"', params)
                        lname_match = re.search(r'"Last Name":"([^"]+)"', params)
                        market_match = re.search(r'"Market":"([^"]+)"', params)
                        
                        if leadid_match and fname_match and lname_match:
                            leadid = leadid_match.group(1)
                            firstname = fname_match.group(1)
                            lastname = lname_match.group(1)
                            market = market_match.group(1) if market_match else ''
                            
                            client_data[phone] = {
                                'leadid': leadid,
                                'firstname': firstname,
                                'lastname': lastname,
                                'market': market
                            }
                            successful += 1
                            
                            if successful <= 20:
                                print(f"   🔧 {phone} → {firstname} {lastname} | Lead: {leadid} | Market: {market}")
                    except:
                        continue
    
    print(f"📊 Processed {processed} CSV rows")
    print(f"📊 Successfully extracted {successful} complete client records")
    print(f"📊 Success rate: {(successful/processed)*100:.1f}%")
    
    return client_data

def create_final_complete_csv():
    """Create the final complete CSV with all available client data"""
    print("🔄 Creating FINAL complete VDP CSV with ALL available client data...")
    
    # Extract ALL available client data
    client_data = extract_all_complete_client_data()
    
    # Get database connects
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        ORDER BY duration_seconds DESC
    ''')
    
    db_connects = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"📊 Found {len(db_connects)} database connects")
    
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
    with open('public/vdp_connects_final.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created FINAL complete VDP CSV with {len(csv_data)} records")
    print(f"📊 {matched_count} records with complete client data")
    print(f"📊 {len(csv_data) - matched_count} records without client data")
    
    # Show top 20 complete records
    complete_only = [row for row in csv_data if row['Leadid']]
    complete_only.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print(f"\n🏆 TOP 20 COMPLETE CONNECTS WITH CLIENT DATA:")
    for i, row in enumerate(complete_only[:20]):
        print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']}")
    
    # Replace the main CSV
    print("\n🔄 Replacing main vdp_connects.csv with FINAL complete data...")
    import shutil
    shutil.copy('public/vdp_connects_final.csv', 'public/vdp_connects.csv')
    print("✅ Replaced public/vdp_connects.csv with FINAL complete client data")
    
    return matched_count, len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = create_final_complete_csv()
    print(f"\n🎉 FINAL RESULTS:")
    print(f"   📊 Total Records: {total_count}")
    print(f"   ✅ Complete Client Data: {complete_count}")
    print(f"   ❌ Missing Client Data: {total_count - complete_count}")
    print(f"   🎯 Success Rate: {(complete_count/total_count)*100:.1f}%")
    print(f"\n🚀 Your complete VDP CSV is ready for $8.00 AOI_CONNECT billing integration!")