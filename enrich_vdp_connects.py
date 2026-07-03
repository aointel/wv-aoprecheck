#!/usr/bin/env python3
"""
Enrich VDP connects with client data from CSV using phone as key
Get: leadid, firstname, lastname, market, duration, agent
"""
import csv
import json
import psycopg2
import os

def extract_client_data_from_params(params_json):
    """Extract client info from CSV params JSON"""
    try:
        params = json.loads(params_json)
        return {
            'leadid': str(params.get('Leadid', '')),
            'firstname': params.get('First Name', ''),
            'lastname': params.get('Last Name', ''),
            'market': params.get('Market', '')
        }
    except:
        return {'leadid': '', 'firstname': '', 'lastname': '', 'market': ''}

def build_phone_lookup(csv_file):
    """Build phone -> client data lookup from CSV"""
    phone_lookup = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            phone = (row['Phone'] or '').strip()
            params = (row['Params'] or '').strip()
            
            if phone and params:
                client_data = extract_client_data_from_params(params)
                if client_data['leadid']:  # Only store if we have a leadid
                    phone_lookup[phone] = client_data
    
    return phone_lookup

def get_vdp_connects():
    """Get existing vdp_connects data from PostgreSQL"""
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        print("❌ No DATABASE_URL found")
        return []
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT phone, agent_id, duration_seconds, connect_date, pickup_time, end_time
        FROM vdp_connects 
        WHERE duration_seconds > 12
        ORDER BY duration_seconds DESC
    """)
    
    connects = cur.fetchall()
    cur.close()
    conn.close()
    
    return connects

def generate_supabase_inserts(connects, phone_lookup):
    """Generate enriched Supabase INSERT statements"""
    
    enriched_records = []
    
    for connect in connects:
        phone, agent_id, duration_seconds, connect_date, pickup_time, end_time = connect
        
        # Lookup client data from CSV
        client_data = phone_lookup.get(phone, {
            'leadid': '', 'firstname': '', 'lastname': '', 'market': ''
        })
        
        # Only include if we found client data
        if client_data['leadid']:
            enriched_record = {
                'phone': phone,
                'agent_id': agent_id,
                'duration_seconds': duration_seconds,
                'connect_date': connect_date,
                'pickup_time': pickup_time,
                'end_time': end_time,
                'leadid': client_data['leadid'],
                'firstname': client_data['firstname'],
                'lastname': client_data['lastname'],
                'market': client_data['market']
            }
            enriched_records.append(enriched_record)
            print(f"✅ {agent_id} → {client_data['firstname']} {client_data['lastname']} | {duration_seconds}s | {phone} | Lead: {client_data['leadid']}")
    
    # Generate SQL INSERTs
    sql_statements = []
    
    for record in enriched_records:
        def escape_sql(value):
            if value is None or value == '':
                return 'NULL'
            escaped = str(value).replace("'", "''")
            return f"'{escaped}'"
        
        insert_sql = f"""INSERT INTO vdp_calls (
    "Date", "Time", "Event", "Phone", "Agent", 
    duration, leadid, firstname, lastname, market
) VALUES (
    {escape_sql(record['connect_date'])},
    {escape_sql(record['end_time'])},
    'END',
    {escape_sql(record['phone'])},
    {escape_sql(record['agent_id'])},
    '{record['duration_seconds']}000',
    {escape_sql(record['leadid'])},
    {escape_sql(record['firstname'])},
    {escape_sql(record['lastname'])},
    {escape_sql(record['market'])}
);"""
        
        sql_statements.append(insert_sql)
    
    return sql_statements, enriched_records

if __name__ == "__main__":
    print("🔄 Building phone lookup from CSV...")
    phone_lookup = build_phone_lookup("attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757193655163.csv")
    print(f"📋 Built lookup for {len(phone_lookup)} phone numbers")
    
    print("\n🔄 Getting VDP connects from database...")
    connects = get_vdp_connects()
    print(f"📊 Found {len(connects)} connects in database")
    
    print("\n🔄 Enriching connects with client data...")
    sql_statements, enriched_records = generate_supabase_inserts(connects, phone_lookup)
    
    print(f"\n📊 ENRICHED DATA SUMMARY:")
    print(f"Total enriched records: {len(enriched_records)}")
    
    # Show top 10
    print(f"\n🏆 TOP 10 ENRICHED CONNECTS:")
    for i, record in enumerate(enriched_records[:10], 1):
        print(f"{i}. Agent {record['agent_id']} → {record['firstname']} {record['lastname']} | {record['duration_seconds']}s | Lead: {record['leadid']} | Market: {record['market']}")
    
    # Write to file
    with open('enriched_vdp_connects.sql', 'w') as f:
        f.write("-- Enriched VDP Connect Data for Supabase\n")
        f.write("-- leadid, firstname, lastname, market, duration, agent\n\n")
        f.write('\n'.join(sql_statements))
    
    print(f"\n✅ Generated enriched_vdp_connects.sql with {len(sql_statements)} records")
    print("🚀 Ready to send enriched VDP data to Supabase!")