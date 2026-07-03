#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
from datetime import datetime

# Database connection
DATABASE_URL = os.environ.get('DATABASE_URL')
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

def parse_params(params_str):
    """Parse the JSON params string and extract all fields"""
    try:
        if not params_str or params_str.strip() == '':
            return {}
        params = json.loads(params_str)
        return params
    except json.JSONDecodeError:
        print(f"Failed to parse params: {params_str}")
        return {}

def import_vdp_data():
    """Import the complete VDP data with all parameters"""
    
    # Clear existing data
    cur.execute("TRUNCATE TABLE vdp_events_complete RESTART IDENTITY;")
    
    with open('/tmp/vdp_complete.csv', 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        
        for row_num, row in enumerate(reader, 1):
            try:
                # Parse the date and time
                date_str = row['Date']
                time_str = row['Time']
                
                # Convert date format from MM/DD/YYYY to YYYY-MM-DD
                if '/' in date_str:
                    month, day, year = date_str.split('/')
                    event_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                else:
                    event_date = date_str
                
                # Convert time format
                event_time = datetime.strptime(time_str, '%I:%M:%S %p').strftime('%H:%M:%S')
                
                # Parse JSON parameters
                params = parse_params(row.get('Params', '{}'))
                
                # Extract all the client data from params
                first_name = params.get('First Name', '')
                last_name = params.get('Last Name', '')
                client_type = params.get('Type', '')
                market = params.get('Market', '')
                lead_id = params.get('Leadid')
                secret_key = params.get('Secretkey', '')
                email = params.get('Email', '')
                address = params.get('Address', '')
                city = params.get('City', '')
                state = params.get('State', '')
                associate_id = params.get('AsscociateId', '')
                referred_by = params.get('Reffered by')
                relationship = params.get('Relationship')
                sponsors_org = params.get('Sponsors Org')
                beneficiary = params.get('Beneficiary', '')
                client_phone = params.get('Phone', '')
                taalk_campaign = params.get('Taalk_Campaign', '')
                taalk_session = params.get('Taalk_Session', '')
                
                # Convert lead_id to integer if present
                if lead_id:
                    try:
                        lead_id = int(lead_id)
                    except (ValueError, TypeError):
                        lead_id = None
                
                # Insert into database
                cur.execute("""
                    INSERT INTO vdp_events_complete (
                        event_date, event_time, event_type, phone, agent_id,
                        first_name, last_name, client_type, market, lead_id,
                        secret_key, email, address, city, state, associate_id,
                        referred_by, relationship, sponsors_org, beneficiary,
                        client_phone, taalk_campaign, taalk_session, raw_params
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s
                    )
                """, (
                    event_date, event_time, row['Event'], row['Phone'], row['Agent'],
                    first_name, last_name, client_type, market, lead_id,
                    secret_key, email, address, city, state, associate_id,
                    referred_by, relationship, sponsors_org, beneficiary,
                    client_phone, taalk_campaign, taalk_session, row.get('Params', '')
                ))
                
                if row_num % 1000 == 0:
                    print(f"Processed {row_num} rows...")
                    conn.commit()
                    
            except Exception as e:
                print(f"Error processing row {row_num}: {e}")
                print(f"Row data: {row}")
                continue
    
    # Final commit
    conn.commit()
    print(f"Import complete! Total rows processed: {row_num}")
    
    # Show some statistics
    cur.execute("SELECT COUNT(*) FROM vdp_events_complete;")
    total_count = cur.fetchone()[0]
    
    cur.execute("SELECT event_type, COUNT(*) FROM vdp_events_complete GROUP BY event_type ORDER BY COUNT(*) DESC;")
    event_stats = cur.fetchall()
    
    print(f"\nImport Summary:")
    print(f"Total records imported: {total_count}")
    print(f"\nEvent type breakdown:")
    for event_type, count in event_stats:
        print(f"  {event_type}: {count}")

if __name__ == "__main__":
    import_vdp_data()
    cur.close()
    conn.close()