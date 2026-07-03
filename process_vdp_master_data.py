#!/usr/bin/env python3
"""
Process VDP Master CSV Data for Reliable Billing
Cross-reference PICK_UP → END events to calculate real durations
Extract complete client data for Supabase insertion
"""
import csv
import json
import re
from datetime import datetime
from collections import defaultdict

def parse_time(date_str, time_str):
    """Parse VDP time format to datetime"""
    try:
        full_datetime = f"{date_str} {time_str}"
        return datetime.strptime(full_datetime, "%m/%d/%Y %I:%M:%S %p")
    except:
        return None

def extract_client_data(params_json):
    """Extract client information from params JSON"""
    try:
        params = json.loads(params_json)
        return {
            'firstname': params.get('First Name', ''),
            'lastname': params.get('Last Name', ''), 
            'leadid': str(params.get('Leadid', '')),
            'email': params.get('Email', ''),
            'address': params.get('Address', ''),
            'city': params.get('City', ''),
            'state': params.get('State', ''),
            'market': params.get('Market', ''),
            'type': params.get('Type', '')
        }
    except:
        return {}

def process_vdp_csv(csv_file):
    """Process VDP master CSV and extract reliable connect data"""
    
    # Track call sessions: phone -> list of events
    call_sessions = defaultdict(list)
    
    # Read and parse CSV
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            date = row['Date'].strip()
            time = row['Time'].strip().strip('"')
            event = row['Event'].strip()
            phone = row['Phone'].strip()
            agent = row['Agent'].strip()
            params = row['Params'].strip()
            
            # Skip if missing critical data
            if not phone or not event or not params:
                continue
                
            # Parse timestamp
            timestamp = parse_time(date, time)
            if not timestamp:
                continue
                
            # Store event data
            event_data = {
                'timestamp': timestamp,
                'date': date,
                'time': time,
                'event': event,
                'phone': phone,
                'agent': agent,
                'params': params,
                'client_data': extract_client_data(params)
            }
            
            call_sessions[phone].append(event_data)
    
    # Find valid PICK_UP → END sequences
    reliable_connects = []
    
    for phone, events in call_sessions.items():
        # Sort events by timestamp
        events.sort(key=lambda x: x['timestamp'])
        
        # Look for PICK_UP → END pairs
        i = 0
        while i < len(events):
            event = events[i]
            
            if event['event'] == 'PICK_UP' and event['agent']:
                # Look for corresponding END event
                j = i + 1
                while j < len(events):
                    next_event = events[j]
                    
                    # Found matching END event
                    if (next_event['event'] == 'END' and 
                        next_event['agent'] == event['agent'] and
                        next_event['phone'] == event['phone']):
                        
                        # Calculate duration in seconds
                        pickup_time = event['timestamp']
                        end_time = next_event['timestamp']
                        duration_seconds = int((end_time - pickup_time).total_seconds())
                        
                        # Only include connects > 12 seconds
                        if duration_seconds > 12:
                            client_data = event['client_data']
                            
                            connect_record = {
                                'date': event['date'],
                                'pickup_time': event['time'],
                                'end_time': next_event['time'],
                                'duration_seconds': duration_seconds,
                                'phone': phone,
                                'agent_id': event['agent'],
                                'leadid': client_data.get('leadid', ''),
                                'firstname': client_data.get('firstname', ''),
                                'lastname': client_data.get('lastname', ''),
                                'email': client_data.get('email', ''),
                                'address': client_data.get('address', ''),
                                'city': client_data.get('city', ''),
                                'state': client_data.get('state', ''),
                                'market': client_data.get('market', ''),
                                'type': client_data.get('type', ''),
                                'params': event['params']
                            }
                            
                            reliable_connects.append(connect_record)
                            print(f"✅ Connect: Agent {event['agent']} → {client_data.get('firstname', 'Unknown')} {client_data.get('lastname', '')} | {duration_seconds}s | {phone}")
                        
                        break
                    j += 1
            i += 1
    
    return reliable_connects

def generate_supabase_inserts(connects):
    """Generate SQL INSERT statements for Supabase"""
    
    print(f"\n🎯 Generating Supabase INSERT for {len(connects)} reliable connects...")
    
    sql_statements = []
    
    for connect in connects:
        # Escape single quotes for SQL
        def escape_sql(value):
            if value is None:
                return 'NULL'
            return f"'{str(value).replace(\"'\", \"''\")}'"
        
        insert_sql = f"""
INSERT INTO vdp_calls (
    "Date", "Time", "Event", "Phone", "Agent", "Params",
    duration, leadid, firstname, lastname, market, email,
    address, city, state
) VALUES (
    {escape_sql(connect['date'])},
    {escape_sql(connect['end_time'])},
    'END',
    {escape_sql(connect['phone'])},
    {escape_sql(connect['agent_id'])},
    {escape_sql(connect['params'])},
    '{connect['duration_seconds']}000',
    {escape_sql(connect['leadid'])},
    {escape_sql(connect['firstname'])},
    {escape_sql(connect['lastname'])},
    {escape_sql(connect['market'])},
    {escape_sql(connect['email'])},
    {escape_sql(connect['address'])},
    {escape_sql(connect['city'])},
    {escape_sql(connect['state'])}
);"""
        
        sql_statements.append(insert_sql.strip())
    
    return sql_statements

if __name__ == "__main__":
    # Process the master CSV file
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757192872071.csv"
    
    print("🔄 Processing VDP Master CSV for reliable connect data...")
    reliable_connects = process_vdp_csv(csv_file)
    
    print(f"\n📊 RELIABLE CONNECT SUMMARY:")
    print(f"Total reliable connects (>12s): {len(reliable_connects)}")
    
    # Show top 10 longest calls
    sorted_connects = sorted(reliable_connects, key=lambda x: x['duration_seconds'], reverse=True)
    print(f"\n🏆 TOP 10 LONGEST CALLS:")
    for i, connect in enumerate(sorted_connects[:10], 1):
        print(f"{i}. Agent {connect['agent_id']} → {connect['firstname']} {connect['lastname']} | {connect['duration_seconds']}s | {connect['phone']}")
    
    # Generate Supabase SQL
    sql_statements = generate_supabase_inserts(reliable_connects[:50])  # First 50 for testing
    
    # Write SQL to file
    with open('supabase_vdp_inserts.sql', 'w') as f:
        f.write("-- Reliable VDP Connect Data for Supabase\n")
        f.write("-- Generated from Master CSV with PICK_UP → END duration calculation\n\n")
        f.write('\n'.join(sql_statements))
    
    print(f"\n✅ Generated supabase_vdp_inserts.sql with {len(sql_statements)} INSERT statements")
    print("🚀 Ready to send reliable VDP connect data to Supabase!")