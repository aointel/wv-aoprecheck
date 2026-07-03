#!/usr/bin/env python3
import psycopg2
import json
import csv
import os

def main():
    print("🔥 EXTRACTING ALL COMPLETE CLIENT DATA FROM WEBHOOK EVENTS...")
    
    # Connect to PostgreSQL where webhook events are stored
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get ALL webhook events with complete client data
    cur.execute('''
        SELECT event_data 
        FROM webhook_events 
        WHERE event_data::text LIKE '%"task"%'
          AND event_data::text LIKE '%"params"%'
          AND event_data::text LIKE '%"Leadid"%'
          AND event_data::text LIKE '%"First Name"%'
          AND event_data::text LIKE '%"phone"%'
        ORDER BY created_at DESC
    ''')
    
    webhook_records = cur.fetchall()
    print(f"📊 Found {len(webhook_records)} webhook events with complete client data")
    
    # Extract unique clients from webhook data
    clients = {}
    for record in webhook_records:
        try:
            event_data = record[0] if isinstance(record[0], dict) else json.loads(record[0])
            
            if 'task' in event_data and 'params' in event_data['task']:
                params = event_data['task']['params']
                phone = event_data.get('task', {}).get('phone', '')
                
                if phone and params.get('Leadid') and params.get('First Name'):
                    clients[phone] = {
                        'leadid': str(params.get('Leadid', '')),
                        'firstname': params.get('First Name', ''),
                        'lastname': params.get('Last Name', ''),
                        'market': params.get('Market', '')
                    }
        except Exception as e:
            continue
    
    print(f"🎯 Extracted {len(clients)} unique clients from webhook data")
    
    # Get ALL database connects
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        ORDER BY duration_seconds DESC
    ''')
    
    db_connects = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"📊 Found {len(db_connects)} total database connects")
    
    # Create comprehensive CSV with ALL data
    csv_data = []
    matched_count = 0
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
        # Check if we have complete client data for this phone
        if db_phone in clients:
            client = clients[db_phone]
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
            # Still include in CSV but with empty client fields
            csv_data.append({
                'Date': db_date if db_date else '',
                'PickupTime': db_time if db_time else '',
                'EndTime': db_time if db_time else '',
                'Duration': db_duration,
                'Agent': db_agent,
                'Phone': db_phone,
                'Leadid': '',  # Empty but ready for population
                'Firstname': '',  # Empty but ready for population  
                'Lastname': '',  # Empty but ready for population
                'Market': ''  # Empty but ready for population
            })
    
    # Write comprehensive CSV
    with open('public/vdp_connects_complete.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created complete VDP CSV with {len(csv_data)} total records")
    print(f"📊 {matched_count} records with COMPLETE client data")
    print(f"📊 {len(csv_data) - matched_count} records ready for future population")
    
    # Show ALL complete records
    complete_records = [row for row in csv_data if row['Leadid']]
    complete_records.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print(f"\n🏆 ALL {len(complete_records)} COMPLETE CONNECTS WITH FULL CLIENT DATA:")
    for i, row in enumerate(complete_records):
        print(f"{i+1:3d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {row['Duration']}s | Lead: {row['Leadid']} | Market: {row['Market']} | Phone: {row['Phone']}")
    
    # Replace main CSV
    print("\n🔄 Replacing main vdp_connects.csv with complete data...")
    import shutil
    shutil.copy('public/vdp_connects_complete.csv', 'public/vdp_connects.csv')
    print("✅ Replaced public/vdp_connects.csv with ALL available client data")
    
    # Show market breakdown
    markets = {}
    for row in complete_records:
        market = row['Market']
        if market not in markets:
            markets[market] = 0
        markets[market] += 1
    
    print(f"\n📊 COMPLETE RECORDS BY MARKET:")
    for market, count in markets.items():
        if market:  # Only show non-empty markets
            print(f"   {market}: {count} records")
    
    print(f"\n🚀 SUCCESS RATE: {(len(complete_records)/len(csv_data))*100:.1f}% ({len(complete_records)}/{len(csv_data)})")
    
    return len(complete_records), len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = main()
    print(f"\n🎉 FINAL RESULTS:")
    print(f"   📊 Total VDP Connects: {total_count}")
    print(f"   ✅ Complete Client Records: {complete_count}")
    print(f"   📝 Awaiting Population: {total_count - complete_count}")
    print(f"   🎯 Success Rate: {(complete_count/total_count)*100:.1f}%")
    print(f"\n💰 Ready for $8.00 AOI_CONNECT billing with COMPLETE client data!")