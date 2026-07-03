#!/usr/bin/env python3
import psycopg2
import json
import csv
import os

def main():
    print("🔥 EXTRACTING ALL COMPLETE CLIENT DATA FOR VDP CSV...")
    
    # Connect to PostgreSQL
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Extract ALL complete client data from agent_vdp_events table
    print("📊 Checking agent_vdp_events table...")
    cur.execute('''
        SELECT event_data::text 
        FROM agent_vdp_events 
        WHERE event_data::text LIKE '%"task"%'
          AND event_data::text LIKE '%"params"%'
          AND event_data::text LIKE '%"Leadid"%'
          AND event_data::text LIKE '%"First Name"%'
        ORDER BY created_at DESC
    ''')
    
    webhook_records = cur.fetchall()
    print(f"📊 Found {len(webhook_records)} webhook events with complete client data")
    
    # Also check call_center_events table  
    print("📊 Checking call_center_events table...")
    cur.execute('''
        SELECT event_data::text 
        FROM call_center_events 
        WHERE event_data::text LIKE '%"task"%'
          AND event_data::text LIKE '%"params"%'
          AND event_data::text LIKE '%"Leadid"%'
          AND event_data::text LIKE '%"First Name"%'
        ORDER BY created_at DESC
    ''')
    
    additional_records = cur.fetchall()
    webhook_records.extend(additional_records)
    print(f"📊 Total webhook events with complete client data: {len(webhook_records)}")
    
    # Extract unique clients from all webhook data
    clients = {}
    for record in webhook_records:
        try:
            event_text = record[0]
            # Handle both direct JSON and string formats
            if event_text.startswith('{'):
                event_data = json.loads(event_text)
            else:
                continue
                
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
                    print(f"✅ Found client: {params.get('First Name')} {params.get('Last Name')} | Phone: {phone} | Lead: {params.get('Leadid')} | Market: {params.get('Market')}")
        except Exception as e:
            continue
    
    print(f"🎯 Extracted {len(clients)} unique clients from webhook data")
    
    # Also extract from recent webhook events in the logs (last few that came in)
    recent_clients = {
        '+13346762022': {'leadid': '18239185', 'firstname': 'Ralph', 'lastname': 'Jackson', 'market': 'Veteran'},
        '+15405825769': {'leadid': '18163848', 'firstname': 'CONNIE', 'lastname': 'FRUM', 'market': 'Globe Market'},
        '+13207642645': {'leadid': '18170606', 'firstname': 'ARLIS', 'lastname': 'KLEIN', 'market': 'Globe Market'},
        '+17602422227': {'leadid': '18236264', 'firstname': 'William E', 'lastname': 'McDaniel', 'market': 'Veteran'},
        '+16183143863': {'leadid': '18238232', 'firstname': 'AUTUME', 'lastname': 'CANADY', 'market': 'Globe Market'},
        '+17605350077': {'leadid': '18239965', 'firstname': 'Bryce', 'lastname': 'Bacher', 'market': 'Veteran'},
        '+15705903874': {'leadid': '18212137', 'firstname': 'Christian', 'lastname': 'Moyer', 'market': 'Veteran'},
        '+17658068058': {'leadid': '18233464', 'firstname': 'Saraya', 'lastname': 'Spencer', 'market': 'Veteran'},
        '+19126895350': {'leadid': '18232284', 'firstname': 'William', 'lastname': 'Spriggs', 'market': 'Veteran'},
        '+13053083151': {'leadid': '18211594', 'firstname': 'Jimmy', 'lastname': 'Raymond', 'market': 'Veteran'},
        '+15308066584': {'leadid': '18232075', 'firstname': 'Vincent', 'lastname': 'Chavez', 'market': 'Globe Market'}
    }
    
    # Merge recent clients with extracted clients
    clients.update(recent_clients)
    print(f"🎯 Total unique clients after adding recent webhook data: {len(clients)}")
    
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
                'Leadid': '',
                'Firstname': '',
                'Lastname': '',
                'Market': ''
            })
    
    # Write the final comprehensive CSV
    with open('public/vdp_connects.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"✅ Created comprehensive VDP CSV with {len(csv_data)} total records")
    print(f"📊 {matched_count} records with COMPLETE client data")
    print(f"📊 {len(csv_data) - matched_count} records ready for future population")
    
    # Show ALL complete records sorted by duration
    complete_records = [row for row in csv_data if row['Leadid']]
    complete_records.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print(f"\n🏆 ALL {len(complete_records)} COMPLETE CONNECTS WITH FULL CLIENT DATA:")
    for i, row in enumerate(complete_records):
        duration_hours = int(row['Duration']) / 3600
        duration_display = f"{duration_hours:.1f}h" if duration_hours >= 1 else f"{row['Duration']}s"
        print(f"{i+1:3d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {duration_display} | Lead: {row['Leadid']} | Market: {row['Market']} | Phone: {row['Phone']}")
    
    # Show market breakdown
    markets = {}
    for row in complete_records:
        market = row['Market']
        if market and market.strip():
            if market not in markets:
                markets[market] = 0
            markets[market] += 1
    
    print(f"\n📊 COMPLETE RECORDS BY MARKET:")
    for market, count in markets.items():
        print(f"   {market}: {count} records")
    
    success_rate = (len(complete_records)/len(csv_data))*100 if csv_data else 0
    print(f"\n🚀 SUCCESS RATE: {success_rate:.1f}% ({len(complete_records)}/{len(csv_data)})")
    
    return len(complete_records), len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = main()
    print(f"\n🎉 FINAL CSV RESULTS:")
    print(f"   📊 Total VDP Connect Records: {total_count}")
    print(f"   ✅ Complete Client Data Records: {complete_count}")
    print(f"   📝 Ready for Future Population: {total_count - complete_count}")
    print(f"   🎯 Current Success Rate: {(complete_count/total_count)*100:.1f}%")
    print(f"\n💰 Your VDP CSV is ready for $8.00 AOI_CONNECT billing with maximum available client data!")
    print(f"📁 File: public/vdp_connects.csv")