#!/usr/bin/env python3
import psycopg2
import json
import csv
import os

def main():
    print("🔥 MINING ALL HISTORICAL WEBHOOK DATA FOR VDP CONNECT PHONE NUMBERS...")
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get ALL actual VDP connect phone numbers that need client data
    print("📊 Getting ALL VDP connect phone numbers...")
    cur.execute('''
        SELECT DISTINCT phone FROM vdp_connects 
        WHERE duration_seconds > 12 
        ORDER BY phone
    ''')
    
    connect_phones = [row[0] for row in cur.fetchall()]
    print(f"📊 Found {len(connect_phones)} unique phone numbers in VDP connects")
    
    # Mine ALL webhook tables for client data
    client_database = {}
    
    # Check agent_vdp_events table
    print("🔍 Mining agent_vdp_events table...")
    cur.execute("SELECT * FROM agent_vdp_events ORDER BY created_at DESC LIMIT 1000")
    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    
    for row in rows:
        row_dict = dict(zip(columns, row))
        # Extract phone and client data from any JSON fields
        for field in ['event_data', 'webhook_data', 'raw_data']:
            if field in row_dict and row_dict[field]:
                try:
                    if isinstance(row_dict[field], str):
                        data = json.loads(row_dict[field])
                    else:
                        data = row_dict[field]
                        
                    # Look for client data patterns
                    phone = None
                    client_info = {}
                    
                    if 'task' in data and 'phone' in data['task']:
                        phone = data['task']['phone']
                        if 'params' in data['task']:
                            params = data['task']['params']
                            client_info = {
                                'leadid': str(params.get('Leadid', '')),
                                'firstname': params.get('First Name', ''),
                                'lastname': params.get('Last Name', ''),
                                'market': params.get('Market', '')
                            }
                    
                    if phone and phone in connect_phones and client_info.get('leadid'):
                        client_database[phone] = client_info
                        print(f"✅ FOUND: {client_info['firstname']} {client_info['lastname']} | Lead: {client_info['leadid']} | Phone: {phone}")
                except:
                    continue
    
    # Check vdp_events_complete table
    print("🔍 Mining vdp_events_complete table...")
    cur.execute("SELECT * FROM vdp_events_complete ORDER BY created_at DESC LIMIT 2000")
    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    
    for row in rows:
        row_dict = dict(zip(columns, row))
        # Look through all columns for JSON data with client info
        for field_name, field_value in row_dict.items():
            if field_value and isinstance(field_value, (str, dict)):
                try:
                    if isinstance(field_value, str) and (field_value.startswith('{') or field_value.startswith('[')):
                        data = json.loads(field_value)
                    elif isinstance(field_value, dict):
                        data = field_value
                    else:
                        continue
                        
                    # Extract client data from various JSON structures
                    phone = None
                    client_info = {}
                    
                    # Pattern 1: Direct task structure
                    if 'task' in data and 'phone' in data['task']:
                        phone = data['task']['phone']
                        if 'params' in data['task']:
                            params = data['task']['params']
                            client_info = {
                                'leadid': str(params.get('Leadid', '')),
                                'firstname': params.get('First Name', ''),
                                'lastname': params.get('Last Name', ''),
                                'market': params.get('Market', '')
                            }
                    
                    # Pattern 2: Direct phone/leadid fields
                    elif 'phone' in data and ('Leadid' in data or 'leadid' in data):
                        phone = data['phone']
                        client_info = {
                            'leadid': str(data.get('Leadid', data.get('leadid', ''))),
                            'firstname': data.get('First Name', data.get('firstname', '')),
                            'lastname': data.get('Last Name', data.get('lastname', '')),
                            'market': data.get('Market', data.get('market', ''))
                        }
                    
                    if phone and phone in connect_phones and client_info.get('leadid'):
                        if phone not in client_database:
                            client_database[phone] = client_info
                            print(f"✅ FOUND: {client_info['firstname']} {client_info['lastname']} | Lead: {client_info['leadid']} | Phone: {phone}")
                except:
                    continue
    
    print(f"\n🎯 EXTRACTED {len(client_database)} CLIENT RECORDS FROM WEBHOOK DATA")
    
    # Get ALL VDP connects with duration and agent data
    cur.execute('''
        SELECT phone, agent_id, duration_seconds, connect_date, end_time 
        FROM vdp_connects 
        ORDER BY duration_seconds DESC
    ''')
    
    db_connects = cur.fetchall()
    cur.close()
    conn.close()
    
    # Build comprehensive CSV with ALL data
    csv_data = []
    complete_count = 0
    
    for db_connect in db_connects:
        db_phone, db_agent, db_duration, db_date, db_time = db_connect
        
        if db_phone in client_database:
            client = client_database[db_phone]
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
            complete_count += 1
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
    
    # Write the COMPLETE CSV
    with open('public/vdp_connects.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'PickupTime', 'EndTime', 'Duration', 'Agent', 'Phone', 'Leadid', 'Firstname', 'Lastname', 'Market']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in csv_data:
            writer.writerow(row)
    
    print(f"\n💰 VDP CSV COMPLETED FOR $8.00 AOI_CONNECT BILLING!")
    print(f"   📊 Total Records: {len(csv_data)}")
    print(f"   ✅ Complete Client Data: {complete_count}")
    print(f"   📝 Needs Data: {len(csv_data) - complete_count}")
    
    success_rate = (complete_count/len(csv_data))*100 if csv_data else 0
    print(f"   🚀 Success Rate: {success_rate:.1f}%")
    
    # Show top complete records
    complete_records = [row for row in csv_data if row['Leadid']]
    complete_records.sort(key=lambda x: int(x['Duration']), reverse=True)
    
    if complete_records:
        print(f"\n🏆 TOP 10 COMPLETE RECORDS:")
        for i, row in enumerate(complete_records[:10]):
            duration = int(row['Duration'])
            if duration >= 3600:
                duration_display = f"{duration/3600:.1f}h"
            elif duration >= 60:
                duration_display = f"{duration/60:.1f}m"
            else:
                duration_display = f"{duration}s"
            print(f"{i+1:2d}. Agent {row['Agent']} → {row['Firstname']} {row['Lastname']} | {duration_display} | Lead: {row['Leadid']} | Market: {row['Market']}")
    
    return complete_count, len(csv_data)

if __name__ == "__main__":
    complete_count, total_count = main()
    print(f"\n📁 File: public/vdp_connects.csv")
    print(f"🎯 {complete_count}/{total_count} records with complete client data for accurate AOI billing!")