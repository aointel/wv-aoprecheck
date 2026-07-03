#!/usr/bin/env python3
import csv
import re
import psycopg2
import os
from datetime import datetime

def extract_client_from_malformed_json(params_str):
    """Extract client data from malformed JSON params"""
    try:
        # Extract First Name
        firstname_match = re.search(r'First Name["\']?\s*:\s*["\']([^"\']+)["\']', params_str, re.IGNORECASE)
        firstname = firstname_match.group(1) if firstname_match else ''
        
        # Extract Last Name
        lastname_match = re.search(r'Last Name["\']?\s*:\s*["\']([^"\']+)["\']', params_str, re.IGNORECASE)
        lastname = lastname_match.group(1) if lastname_match else ''
        
        # Extract Leadid
        leadid_match = re.search(r'Leadid["\']?\s*:\s*["\']?(\d+)["\']?', params_str, re.IGNORECASE)
        leadid = leadid_match.group(1) if leadid_match else ''
        
        # Extract Market
        market_match = re.search(r'Market["\']?\s*:\s*["\']([^"\']+)["\']', params_str, re.IGNORECASE)
        market = market_match.group(1) if market_match else ''
        
        return {
            'firstname': firstname.strip(),
            'lastname': lastname.strip(),
            'leadid': leadid.strip(),
            'market': market.strip()
        }
    except Exception as e:
        print(f"Error extracting data: {e}")
        return {}

def main():
    print("🔄 Processing CSV to extract complete client data...")
    
    # Read CSV and build phone lookup
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757193655163.csv"
    phone_lookup = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            phone = (row.get('Phone', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            
            if phone and params:
                client_data = extract_client_from_malformed_json(params)
                if client_data['leadid'] and client_data['firstname']:
                    phone_lookup[phone] = client_data
    
    print(f"📊 Built lookup for {len(phone_lookup)} phone numbers with complete client data")
    
    # Get existing VDP connects from database
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get connects with >12 seconds duration
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        WHERE duration_seconds > 12
        ORDER BY duration_seconds DESC
    ''')
    
    connects = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"📊 Found {len(connects)} connects in database with >12s duration")
    
    # Generate enriched Supabase data
    enriched_data = []
    
    for connect in connects:
        phone, agent_id, duration_seconds, connect_date, end_time = connect
        
        # Look up client data by phone
        if phone in phone_lookup:
            client_data = phone_lookup[phone]
            
            # Duration in milliseconds for Supabase
            duration_ms = duration_seconds * 1000
            
            enriched_data.append({
                'date': connect_date,
                'time': end_time,
                'event': 'END',
                'phone': phone,
                'agent': agent_id,
                'duration': str(duration_ms),
                'leadid': client_data['leadid'],
                'firstname': client_data['firstname'],
                'lastname': client_data['lastname'],
                'market': client_data['market']
            })
    
    print(f"✅ Enriched {len(enriched_data)} connects with complete client data")
    
    # Show top 10 enriched connects
    print("\n🏆 TOP 10 ENRICHED CONNECTS:")
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
    with open('enriched_vdp_data.sql', 'w') as f:
        f.write('-- Enriched VDP Connect Data with Complete Client Info\n')
        f.write('-- Fields: leadid, firstname, lastname, market, duration, agent\n\n')
        f.write('\n'.join(sql_statements))
    
    print(f"✅ Generated enriched_vdp_data.sql with {len(sql_statements)} records")
    print("🚀 Ready to send complete client data to Supabase!")

if __name__ == "__main__":
    main()