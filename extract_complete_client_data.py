#!/usr/bin/env python3
import psycopg2
import csv
import os

def main():
    print("🔥 EXTRACTING ALL CLIENT DATA FROM VDP_EVENTS_COMPLETE TABLE...")
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Extract ALL client data from vdp_events_complete table
    print("📊 Extracting ALL client records from vdp_events_complete...")
    cur.execute('''
        SELECT phone, first_name, last_name, lead_id, market 
        FROM vdp_events_complete 
        WHERE phone IS NOT NULL 
          AND first_name IS NOT NULL 
          AND lead_id IS NOT NULL
        ORDER BY processed_at DESC
    ''')
    
    client_records = cur.fetchall()
    print(f"📊 Found {len(client_records)} complete client records in database")
    
    # Build client database
    clients = {}
    for record in client_records:
        phone, firstname, lastname, leadid, market = record
        if phone and firstname and leadid:
            clients[phone] = {
                'leadid': str(leadid) if leadid else '',
                'firstname': firstname if firstname else '',
                'lastname': lastname if lastname else '',
                'market': market if market else ''
            }
            print(f"✅ {firstname} {lastname} | Lead: {leadid} | Phone: {phone} | Market: {market}")
    
    print(f"\n🎯 EXTRACTED {len(clients)} UNIQUE CLIENTS FROM DATABASE")
    
    # Get ALL VDP connects
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        ORDER BY duration_seconds DESC
    ''')
    
    db_connects = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"📊 Processing {len(db_connects)} VDP connects")
    
    # Build comprehensive CSV
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
    
    # Write comprehensive CSV
    with open('public/vdp_connects.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"\n✅ COMPREHENSIVE VDP CSV COMPLETE:")
    print(f"   📊 Total Records: {len(csv_data)}")
    print(f"   ✅ Complete Client Data: {matched_count}")
    print(f"   📝 Incomplete Records: {len(csv_data) - matched_count}")
    
    # Show ALL complete records
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
    
    # Market breakdown
    markets = {}
    for row in complete_records:
        market = row['Market']
        if market and market.strip():
            markets[market] = markets.get(market, 0) + 1
    
    print(f"\n📊 COMPLETE RECORDS BY MARKET:")
    for market, count in sorted(markets.items()):
        print(f"   {market}: {count} records")
    
    success_rate = (len(complete_records)/len(csv_data))*100 if csv_data else 0
    print(f"\n🚀 SUCCESS RATE: {success_rate:.1f}% ({len(complete_records)}/{len(csv_data)})")
    
    return len(complete_records), len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = main()
    print(f"\n💰 VDP CSV READY FOR $8.00 AOI_CONNECT BILLING!")
    print(f"📁 File: public/vdp_connects.csv")
    print(f"🎯 {complete_count} records with complete client data for accurate billing")