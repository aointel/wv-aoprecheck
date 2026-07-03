#!/usr/bin/env python3
import csv
import json
from datetime import datetime

def parse_time(date_str, time_str):
    """Parse date and time into datetime object"""
    try:
        # Handle time format like "5:22:09 PM"
        datetime_str = f"{date_str} {time_str}"
        return datetime.strptime(datetime_str, "%m/%d/%Y %I:%M:%S %p")
    except:
        return None

def main():
    print("🔄 Processing CSV to extract complete client data with actual duration...")
    
    # Read CSV and track PICK_UP → END events
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194382543.csv"
    
    # Track calls by phone number
    calls = {}
    
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
                        pickup_info['duration_ms'] = duration_seconds * 1000
                        pickup_info['completed'] = True
    
    # Extract completed connects with >12 second duration
    enriched_data = []
    
    for phone, agents in calls.items():
        for agent_id, call_info in agents.items():
            if call_info.get('completed') and call_info.get('duration_seconds', 0) > 12:
                client = call_info['client_data']
                enriched_data.append({
                    'date': call_info['pickup_date'],
                    'time': call_info['end_time_str'],
                    'event': 'END',
                    'phone': phone,
                    'agent': agent_id,
                    'duration': str(call_info['duration_ms']),
                    'leadid': client['leadid'],
                    'firstname': client['firstname'],
                    'lastname': client['lastname'],
                    'market': client['market'],
                    'duration_seconds': call_info['duration_seconds']
                })
    
    # Sort by duration (longest first)
    enriched_data.sort(key=lambda x: x['duration_seconds'], reverse=True)
    
    print(f"✅ Found {len(enriched_data)} complete connects with >12s duration and client data")
    
    # Show top 10 connects
    print("\n🏆 TOP 10 CONNECTS BY DURATION:")
    for i, data in enumerate(enriched_data[:10]):
        print(f"{i+1:2d}. Agent {data['agent']} → {data['firstname']} {data['lastname']} | {data['duration_seconds']}s | Lead: {data['leadid']} | Market: {data['market']}")
    
    # Generate SQL for Supabase
    sql_statements = []
    for data in enriched_data:
        sql = f'''INSERT INTO vdp_calls (
    "Date", "Time", "Event", "Phone", "Agent", 
    duration, leadid, firstname, lastname, market
) VALUES (
    '{data['date']}',
    '{data['time']}',
    '{data['event']}',
    '{data['phone']}',
    '{data['agent']}',
    '{data['duration']}',
    '{data['leadid']}',
    '{data['firstname'].replace("'", "''")}',
    '{data['lastname'].replace("'", "''")}',
    '{data['market'].replace("'", "''")}'
) ON CONFLICT ("Date", "Time", "Event", "Phone", "Agent") DO NOTHING;'''
        sql_statements.append(sql)
    
    # Write to file
    with open('complete_vdp_connects.sql', 'w') as f:
        f.write('-- Complete VDP Connects with Actual Duration from CSV\n')
        f.write('-- Fields: leadid, firstname, lastname, market, duration, agent\n\n')
        f.write('\n'.join(sql_statements))
    
    print(f"✅ Generated complete_vdp_connects.sql with {len(sql_statements)} records")
    print("🚀 Complete client data with actual durations ready for Supabase!")

if __name__ == "__main__":
    main()