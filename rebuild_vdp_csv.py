#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
from datetime import datetime

def parse_csv_datetime(date_str, time_str):
    """Parse CSV date and time into datetime object"""
    try:
        # Handle time format with quotes
        time_clean = time_str.strip('"')
        datetime_str = f"{date_str} {time_clean}"
        return datetime.strptime(datetime_str, "%m/%d/%Y %I:%M:%S %p")
    except Exception as e:
        print(f"Error parsing datetime: {date_str} {time_str} -> {e}")
        return None

def main():
    print("🔄 Rebuilding VDP CSV with complete client data...")
    
    # Parse your complete CSV to track PICK_UP → END events
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194525624.csv"
    calls = {}  # Track ongoing calls by phone+agent
    completed_calls = []  # Store completed PICK_UP → END sequences
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            phone = (row.get('Phone', '') or '').strip()
            event = (row.get('Event', '') or '').strip()
            agent = (row.get('Agent', '') or '').strip()
            date = (row.get('Date', '') or '').strip()
            time = (row.get('Time', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            
            if not phone or not event:
                continue
                
            # Parse client data from params
            client_data = {}
            if params:
                try:
                    params_data = json.loads(params)
                    client_data = {
                        'leadid': str(params_data.get('Leadid', '')),
                        'firstname': params_data.get('First Name', ''),
                        'lastname': params_data.get('Last Name', ''),
                        'market': params_data.get('Market', '')
                    }
                except:
                    continue
            
            # Track PICK_UP events
            if event == 'PICK_UP' and agent and client_data.get('leadid'):
                call_key = f"{phone}_{agent}"
                pickup_time = parse_csv_datetime(date, time)
                if pickup_time:
                    calls[call_key] = {
                        'phone': phone,
                        'agent': agent,
                        'pickup_time': pickup_time,
                        'pickup_date': date,
                        'pickup_time_str': time,
                        'client_data': client_data
                    }
            
            # Track END events and calculate duration
            elif event == 'END' and agent:
                call_key = f"{phone}_{agent}"
                if call_key in calls:
                    call_info = calls[call_key]
                    end_time = parse_csv_datetime(date, time)
                    if end_time:
                        duration_seconds = int((end_time - call_info['pickup_time']).total_seconds())
                        
                        # Only keep calls >12 seconds (connects)
                        if duration_seconds > 12:
                            completed_calls.append({
                                'phone': phone,
                                'agent': agent,
                                'duration_seconds': duration_seconds,
                                'pickup_date': call_info['pickup_date'],
                                'pickup_time': call_info['pickup_time_str'],
                                'end_time': time,
                                'leadid': call_info['client_data']['leadid'],
                                'firstname': call_info['client_data']['firstname'],
                                'lastname': call_info['client_data']['lastname'],
                                'market': call_info['client_data']['market']
                            })
                    
                    # Remove from tracking
                    del calls[call_key]
    
    print(f"📊 Found {len(completed_calls)} complete PICK_UP→END connects in CSV")
    
    # Get current vdp_connects from database for comparison
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
    
    # Create lookup for easier matching
    csv_lookup = {}
    for call in completed_calls:
        phone = call['phone']
        agent = call['agent']
        duration = call['duration_seconds']
        
        # Use phone+agent as primary key, with duration as fallback
        key = f"{phone}_{agent}"
        if key not in csv_lookup:
            csv_lookup[key] = []
        csv_lookup[key].append(call)
    
    # Create new complete CSV with all data
    csv_data = []
    matched_count = 0
    
    # Process database connects and match with CSV data
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
        # Try to find matching CSV data
        key = f"{db_phone}_{db_agent}"
        matched = False
        
        if key in csv_lookup:
            # Find best duration match
            candidates = csv_lookup[key]
            best_match = None
            min_diff = float('inf')
            
            for candidate in candidates:
                diff = abs(candidate['duration_seconds'] - db_duration)
                if diff < min_diff:
                    min_diff = diff
                    best_match = candidate
            
            if best_match:
                csv_data.append({
                    'Date': best_match['pickup_date'],
                    'PickupTime': best_match['pickup_time'],
                    'EndTime': best_match['end_time'],
                    'Duration': db_duration,  # Use database duration as authoritative
                    'Agent': db_agent,
                    'Phone': db_phone,
                    'Leadid': best_match['leadid'],
                    'Firstname': best_match['firstname'],
                    'Lastname': best_match['lastname'],
                    'Market': best_match['market']
                })
                matched_count += 1
                matched = True
        
        if not matched:
            # No CSV match found, use database data only
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
    
    # Write the new complete CSV
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
        print(f"   Agent {record['Agent']} → {record['Firstname']} {record['Lastname']} | {record['Duration']}s | Lead: {record['Leadid']} | Market: {record['Market']}")

if __name__ == "__main__":
    main()