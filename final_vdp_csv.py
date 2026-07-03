#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
from datetime import datetime

def parse_csv_datetime(date_str, time_str):
    """Parse CSV date and time into datetime object"""
    try:
        time_clean = time_str.strip('"')
        datetime_str = f"{date_str} {time_clean}"
        return datetime.strptime(datetime_str, "%m/%d/%Y %I:%M:%S %p")
    except Exception as e:
        return None

def main():
    print("🔄 Creating final VDP CSV with complete client data...")
    
    # Parse CSV and get all complete client data from NEW/PICK_UP events
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194525624.csv"
    client_data = {}  # phone -> client info
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            phone = (row.get('Phone', '') or '').strip()
            event = (row.get('Event', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            
            if not phone or not params:
                continue
                
            # Parse client data from params for any event that has complete data
            if event in ['NEW', 'PICK_UP', 'ASSIGN_TO', 'BLASTER'] and params:
                try:
                    params_data = json.loads(params)
                    leadid = str(params_data.get('Leadid', ''))
                    firstname = params_data.get('First Name', '')
                    lastname = params_data.get('Last Name', '')
                    market = params_data.get('Market', '')
                    
                    if leadid and firstname and lastname:
                        client_data[phone] = {
                            'leadid': leadid,
                            'firstname': firstname,
                            'lastname': lastname,
                            'market': market
                        }
                except:
                    continue
    
    print(f"📊 Extracted client data for {len(client_data)} phone numbers")
    
    # Show some examples
    print("\n📋 Sample client data extracted:")
    count = 0
    for phone, data in client_data.items():
        if count < 5:
            print(f"   {phone} → {data['firstname']} {data['lastname']} | Lead: {data['leadid']} | Market: {data['market']}")
            count += 1
    
    # Get current vdp_connects from database
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
    
    print(f"📊 Database has {len(db_connects)} connects")
    
    # Create new complete CSV
    csv_data = []
    matched_count = 0
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
        # Check if we have client data for this phone number
        if db_phone in client_data:
            client = client_data[db_phone]
            csv_data.append({
                'Date': db_date,
                'PickupTime': db_time,
                'EndTime': db_time,
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
                'Date': db_date,
                'PickupTime': db_time,
                'EndTime': db_time,
                'Duration': db_duration,
                'Agent': db_agent,
                'Phone': db_phone,
                'Leadid': '',
                'Firstname': '',
                'Lastname': '',
                'Market': ''
            })
    
    # Write the complete CSV
    with open('public/vdp_connects_complete.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created complete VDP CSV with {len(csv_data)} records")
    print(f"📊 {matched_count} records matched with complete client data")
    print(f"📊 {len(csv_data) - matched_count} records without client data")
    
    # Show top 10 complete records
    complete_only = [row for row in csv_data if row['Leadid']]
    complete_only.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print("\n🏆 TOP 10 COMPLETE CONNECTS WITH CLIENT DATA:")
    for i, row in enumerate(complete_only[:10]):
        print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']} | Phone: {row['Phone']}")
    
    # Test the specific phone number you asked about
    print(f"\n🔍 CHECKING PHONE +13207642645:")
    arlis_records = [row for row in csv_data if '+13207642645' in row['Phone']]
    for record in arlis_records:
        if record['Leadid']:
            print(f"   ✅ Agent {record['Agent']} → {record['Firstname']} {record['Lastname']} | {record['Duration']}s | Lead: {record['Leadid']} | Market: {record['Market']}")
        else:
            print(f"   ❌ Agent {record['Agent']} → NO CLIENT DATA | {record['Duration']}s")
    
    # Replace the old corrupted CSV
    print("\n🔄 Replacing corrupted vdp_connects.csv with complete data...")
    import shutil
    shutil.copy('public/vdp_connects_complete.csv', 'public/vdp_connects.csv')
    print("✅ Replaced public/vdp_connects.csv with complete client data")

if __name__ == "__main__":
    main()