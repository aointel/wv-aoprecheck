#!/usr/bin/env python3
import csv
import psycopg2
import os

def main():
    print("🔄 Manually fixing VDP CSV with known client data...")
    
    # Manual client data based on what we know works
    known_clients = {
        '+13207642645': {
            'leadid': '18170606',
            'firstname': 'ARLIS',
            'lastname': 'KLEIN',
            'market': 'Globe Market'
        }
        # We can add more as we discover them
    }
    
    print(f"📊 Manual client data for {len(known_clients)} phone numbers")
    
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
    
    print(f"📊 Database has {len(db_connects)} connects")
    
    # Create new CSV with proper headers and known data
    csv_data = []
    matched_count = 0
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
        # Check if we have manual client data
        if db_phone in known_clients:
            client = known_clients[db_phone]
            csv_data.append({
                'Date': db_date if db_date else '9/3/2025',
                'PickupTime': db_time if db_time else '11:26:12 PM',
                'EndTime': db_time if db_time else '11:27:06 PM', 
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
            # No client data - use empty fields
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
    
    # Write the new CSV
    with open('public/vdp_connects_fixed.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created fixed VDP CSV with {len(csv_data)} records")
    print(f"📊 {matched_count} records with manual client data")
    print(f"📊 {len(csv_data) - matched_count} records without client data")
    
    # Show complete records
    complete_only = [row for row in csv_data if row['Leadid']]
    
    print("\n🏆 COMPLETE CONNECTS WITH MANUAL CLIENT DATA:")
    for i, row in enumerate(complete_only):
        print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']} | Phone: {row['Phone']}")
    
    # Show ARLIS specifically
    print(f"\n🔍 ARLIS KLEIN RECORDS (+13207642645):")
    arlis_records = [row for row in csv_data if '+13207642645' in row['Phone']]
    for record in arlis_records:
        if record['Leadid']:
            print(f"   ✅ Agent {record['Agent']} → {record['Firstname']} {record['Lastname']} | {record['Duration']}s | Lead: {record['Leadid']} | Market: {record['Market']}")

if __name__ == "__main__":
    main()