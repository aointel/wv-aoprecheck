#!/usr/bin/env python3
import csv
import json
import psycopg2
import os

def main():
    print("🔄 Creating fixed VDP CSV with complete client data...")
    
    # First get data from your complete CSV file - only END events
    csv_file = "attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757194525624.csv"
    complete_data = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            event = (row.get('Event', '') or '').strip()
            phone = (row.get('Phone', '') or '').strip()
            agent = (row.get('Agent', '') or '').strip()
            params = (row.get('Params', '') or '').strip()
            date = (row.get('Date', '') or '').strip()
            time = (row.get('Time', '') or '').strip()
            
            # Only process END events with complete data
            if event == 'END' and phone and agent and params:
                try:
                    params_data = json.loads(params)
                    leadid = str(params_data.get('Leadid', ''))
                    firstname = params_data.get('First Name', '')
                    lastname = params_data.get('Last Name', '')
                    market = params_data.get('Market', '')
                    
                    if leadid and firstname and lastname:
                        complete_data.append({
                            'phone': phone,
                            'agent': agent,
                            'date': date,
                            'time': time,
                            'leadid': leadid,
                            'firstname': firstname,
                            'lastname': lastname,
                            'market': market
                        })
                except:
                    continue
    
    print(f"📊 Found {len(complete_data)} complete END events in CSV")
    
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
    
    print(f"📊 Found {len(db_connects)} connects in database")
    
    # Create new complete CSV
    csv_data = []
    
    # Use complete CSV data as primary source
    for record in complete_data:
        # Find duration from database if available
        duration = 60  # Default duration
        for db_connect in db_connects:
            db_phone, db_agent, db_duration, db_date, db_time = db_connect
            if db_phone == record['phone'] and db_agent == record['agent']:
                duration = db_duration
                break
                
        csv_data.append({
            'Date': record['date'],
            'Time': record['time'],
            'Duration': duration,
            'Agent': record['agent'],
            'Phone': record['phone'],
            'Leadid': record['leadid'],
            'Firstname': record['firstname'],
            'Lastname': record['lastname'],
            'Market': record['market']
        })
    
    # Also add any database connects that weren't in CSV (missing client data)
    csv_phones = {(r['phone'], r['agent']) for r in complete_data}
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        if (db_phone, db_agent) not in csv_phones:
            csv_data.append({
                'Date': db_date,
                'Time': db_time,
                'Duration': db_duration,
                'Agent': db_agent,
                'Phone': db_phone,
                'Leadid': '',
                'Firstname': '',
                'Lastname': '',
                'Market': ''
            })
    
    # Write new complete CSV
    with open('public/vdp_connects_complete.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'Time', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
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
    complete_only.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print("\n🏆 TOP 10 COMPLETE CONNECTS:")
    for i, row in enumerate(complete_only[:10]):
        print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']}")

if __name__ == "__main__":
    main()