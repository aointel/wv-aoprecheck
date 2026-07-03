#!/usr/bin/env python3
import psycopg2
import json
import csv
import os

def main():
    print("🔥 EXTRACTING ALL WEBHOOK DATA TO POPULATE VDP CSV COMPLETELY...")
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Extract ALL webhook events with task data - this is where the complete client info is
    print("📊 Extracting ALL webhook events with complete client data...")
    cur.execute('''
        SELECT raw_data 
        FROM webhook_events 
        WHERE raw_data::text LIKE '%"task"%'
          AND raw_data::text LIKE '%"params"%'
          AND raw_data::text LIKE '%"Leadid"%'
          AND raw_data::text LIKE '%"First Name"%'
        ORDER BY created_at DESC
    ''')
    
    webhook_records = cur.fetchall()
    print(f"📊 Found {len(webhook_records)} webhook events with complete client data")
    
    # Build comprehensive client database
    clients = {}
    
    for record in webhook_records:
        try:
            # Parse the webhook data
            raw_data = record[0]
            if isinstance(raw_data, str):
                event_data = json.loads(raw_data)
            else:
                event_data = raw_data
                
            if 'task' in event_data and 'params' in event_data['task']:
                params = event_data['task']['params']
                phone = event_data['task'].get('phone', '')
                
                if phone and params.get('Leadid') and params.get('First Name'):
                    clients[phone] = {
                        'leadid': str(params.get('Leadid', '')),
                        'firstname': params.get('First Name', ''),
                        'lastname': params.get('Last Name', ''),
                        'market': params.get('Market', '')
                    }
                    print(f"✅ {params.get('First Name')} {params.get('Last Name')} | Lead: {params.get('Leadid')} | Phone: {phone} | Market: {params.get('Market')}")
        except Exception as e:
            continue
    
    print(f"\n🎯 Extracted {len(clients)} unique clients from ALL webhook data")
    
    # Get ALL VDP connects
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        ORDER BY duration_seconds DESC
    ''')
    
    db_connects = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"📊 Processing {len(db_connects)} total VDP connects")
    
    # Build the complete CSV
    csv_data = []
    matched_count = 0
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
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
    
    # Write the complete CSV
    with open('public/vdp_connects.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"\n✅ COMPLETE VDP CSV CREATED:")
    print(f"   📊 Total Records: {len(csv_data)}")
    print(f"   ✅ Complete Client Data: {matched_count}")
    print(f"   📝 Incomplete Records: {len(csv_data) - matched_count}")
    
    # Show all complete records
    complete_records = [row for row in csv_data if row['Leadid']]
    complete_records.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    print(f"\n🏆 ALL {len(complete_records)} COMPLETE RECORDS:")
    for i, row in enumerate(complete_records):
        duration = int(row['Duration'])
        if duration >= 3600:
            duration_display = f"{duration/3600:.1f}h"
        elif duration >= 60:
            duration_display = f"{duration/60:.1f}m"
        else:
            duration_display = f"{duration}s"
        print(f"{i+1:3d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {duration_display} | Lead: {row['Leadid']} | Market: {row['Market']}")
    
    success_rate = (len(complete_records)/len(csv_data))*100 if csv_data else 0
    print(f"\n🚀 SUCCESS RATE: {success_rate:.1f}% ({len(complete_records)}/{len(csv_data)})")
    
    return len(complete_records), len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = main()
    print(f"\n💰 VDP CSV ready for $8.00 AOI_CONNECT billing with {complete_count} complete records!")