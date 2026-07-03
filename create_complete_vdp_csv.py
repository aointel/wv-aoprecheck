#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
from datetime import datetime

def parse_time(date_str, time_str):
    """Parse date and time into datetime object"""
    try:
        datetime_str = f"{date_str} {time_str}"
        return datetime.strptime(datetime_str, "%m/%d/%Y %I:%M:%S %p")
    except:
        return None

def main():
    print("🔄 Creating complete VDP CSV with client data...")
    
    # Build phone lookup from your complete CSV
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194525624.csv"
    phone_lookup = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        calls = {}  # Track PICK_UP → END events
        
        for row in reader:
            phone = (row.get('Phone', '') or '').strip()
            event = (row.get('Event', '') or '').strip()
            agent = (row.get('Agent', '') or '').strip()
            date = (row.get('Date', '') or '').strip()
            time = (row.get('Time', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            
            if not phone or not event:
                continue
                
            # Initialize call tracking for this phone
            if phone not in calls:
                calls[phone] = {}
            
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
                pickup_time = parse_time(date, time)
                if pickup_time:
                    calls[phone][agent] = {
                        'pickup_time': pickup_time,
                        'pickup_date': date,
                        'pickup_time_str': time,
                        'agent': agent,
                        'client_data': client_data
                    }
            
            # Track END events and calculate duration
            elif event == 'END' and agent:
                end_time = parse_time(date, time)
                if end_time and agent in calls[phone]:
                    pickup_info = calls[phone][agent]
                    duration_seconds = int((end_time - pickup_info['pickup_time']).total_seconds())
                    
                    # Only process calls >12 seconds
                    if duration_seconds > 12:
                        pickup_info['end_time'] = end_time
                        pickup_info['end_date'] = date
                        pickup_info['end_time_str'] = time
                        pickup_info['duration_seconds'] = duration_seconds
                        pickup_info['completed'] = True
                        
                        # Add to phone lookup
                        phone_lookup[phone] = {
                            'agent': agent,
                            'duration_seconds': duration_seconds,
                            'pickup_date': pickup_info['pickup_date'],
                            'end_time_str': time,
                            'client_data': pickup_info['client_data']
                        }
    
    print(f"📊 Built lookup for {len(phone_lookup)} complete connects from CSV")
    
    # Get all vdp_connects from database
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
    
    print(f"📊 Found {len(connects)} connects in database")
    
    # Create new CSV with complete data
    csv_data = []
    
    for connect in connects:
        phone, agent_id, duration_seconds, connect_date, end_time = connect
        
        # Look up complete client data
        if phone in phone_lookup:
            lookup_data = phone_lookup[phone]
            client_data = lookup_data['client_data']
            
            # Use actual duration from CSV if available, otherwise database duration
            actual_duration = lookup_data.get('duration_seconds', duration_seconds)
            
            csv_data.append({
                'Date': lookup_data.get('pickup_date', connect_date),
                'PickupTime': lookup_data.get('pickup_time_str', end_time),
                'EndTime': lookup_data.get('end_time_str', end_time),
                'Duration': actual_duration,
                'Agent': lookup_data.get('agent', agent_id),
                'Phone': phone,
                'Leadid': client_data.get('leadid', ''),
                'Firstname': client_data.get('firstname', ''),
                'Lastname': client_data.get('lastname', ''),
                'Market': client_data.get('market', '')
            })
        else:
            # No lookup data available, use database data only
            csv_data.append({
                'Date': connect_date,
                'PickupTime': end_time,
                'EndTime': end_time,
                'Duration': duration_seconds,
                'Agent': agent_id,
                'Phone': phone,
                'Leadid': '',
                'Firstname': '',
                'Lastname': '',
                'Market': ''
            })
    
    # Write new complete CSV
    with open('public/vdp_connects_complete.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created complete VDP CSV with {len(csv_data)} records")
    
    # Show stats
    complete_records = sum(1 for row in csv_data if row['Leadid'])
    print(f"📊 {complete_records} records have complete client data")
    print(f"📊 {len(csv_data) - complete_records} records missing client data")
    
    # Show top 10 complete records
    complete_only = [row for row in csv_data if row['Leadid']]
    complete_only.sort(key=lambda x: x['Duration'], reverse=True)
    
    print("\n🏆 TOP 10 COMPLETE CONNECTS:")
    for i, row in enumerate(complete_only[:10]):
        print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']}")

if __name__ == "__main__":
    main()