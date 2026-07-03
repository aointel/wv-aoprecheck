#!/usr/bin/env python3
import csv
import json
import psycopg2
import os
import re
from datetime import datetime

# Database connection
DATABASE_URL = os.environ.get('DATABASE_URL')
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

def fix_and_parse_json(params_str):
    """Fix malformed JSON and parse it"""
    try:
        if not params_str or params_str.strip() == '':
            return {}
        
        # Clean up the string
        params_str = params_str.strip()
        if not params_str.startswith('{'):
            return {}
        
        # Fix the missing opening quote issue: {First Name": -> {"First Name":
        fixed_str = re.sub(r'\{([^"]+?)":"', r'{"\1":', params_str)
        
        # Additional cleanup for other potential issues
        fixed_str = fixed_str.replace('null', '"null"')  # Handle null values
        
        params = json.loads(fixed_str)
        return params
    except json.JSONDecodeError as e:
        # If still can't parse, extract manually using regex
        try:
            result = {}
            
            # Extract common fields using regex patterns
            patterns = {
                'First Name': r'"First Name"\s*:\s*"([^"]*)"',
                'Last Name': r'"Last Name"\s*:\s*"([^"]*)"',
                'Type': r'"Type"\s*:\s*"([^"]*)"',
                'Market': r'"Market"\s*:\s*"([^"]*)"',
                'Leadid': r'"Leadid"\s*:\s*(\d+)',
                'Secretkey': r'"Secretkey"\s*:\s*"([^"]*)"',
                'Email': r'"Email"\s*:\s*"([^"]*)"',
                'Address': r'"Address"\s*:\s*"([^"]*)"',
                'City': r'"City"\s*:\s*"([^"]*)"',
                'State': r'"State"\s*:\s*"([^"]*)"',
                'AsscociateId': r'"AsscociateId"\s*:\s*"([^"]*)"',
                'Phone': r'"Phone"\s*:\s*"([^"]*)"',
                'Taalk_Campaign': r'"Taalk_Campaign"\s*:\s*"([^"]*)"',
                'Taalk_Session': r'"Taalk_Session"\s*:\s*"([^"]*)"'
            }
            
            for field, pattern in patterns.items():
                match = re.search(pattern, params_str)
                if match:
                    if field == 'Leadid':
                        result[field] = int(match.group(1))
                    else:
                        result[field] = match.group(1)
                else:
                    result[field] = ''
            
            return result
        except Exception as e2:
            print(f"Manual parsing also failed: {e2}")
            print(f"Original string: {params_str[:200]}...")
            return {}

def convert_date(date_str):
    """Convert MM/DD/YYYY to YYYY-MM-DD"""
    try:
        if '/' in date_str:
            month, day, year = date_str.split('/')
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return date_str
    except:
        return '2025-01-01'  # fallback

def convert_time(time_str):
    """Convert 12-hour time to 24-hour format"""
    try:
        return datetime.strptime(time_str, '%I:%M:%S %p').strftime('%H:%M:%S')
    except:
        return '00:00:00'  # fallback

def safe_int(value):
    """Safely convert to integer"""
    try:
        if value and str(value).strip() and str(value).strip().isdigit():
            return int(value)
        return None
    except:
        return None

def import_vdp_data():
    """Import the complete VDP data with all parameters using fixed JSON parsing"""
    
    # Clear existing data
    cur.execute("TRUNCATE TABLE vdp_events_complete RESTART IDENTITY;")
    print("Cleared existing data...")
    
    row_count = 0
    success_count = 0
    error_count = 0
    
    with open('/tmp/vdp_complete.csv', 'r', newline='', encoding='utf-8') as csvfile:
        # Use proper CSV reader that handles quotes and commas correctly
        reader = csv.DictReader(csvfile)
        
        for row_num, row in enumerate(reader, 1):
            row_count = row_num
            try:
                # Parse the date and time
                event_date = convert_date(row['Date'])
                event_time = convert_time(row['Time'])
                
                # Parse JSON parameters with fixes
                params = fix_and_parse_json(row.get('Params', '{}'))
                
                # Extract all the client data from params
                first_name = params.get('First Name', '') or ''
                last_name = params.get('Last Name', '') or ''
                client_type = params.get('Type', '') or ''
                market = params.get('Market', '') or ''
                lead_id = safe_int(params.get('Leadid'))
                secret_key = params.get('Secretkey', '') or ''
                email = params.get('Email', '') or ''
                address = params.get('Address', '') or ''
                city = params.get('City', '') or ''
                state = params.get('State', '') or ''
                associate_id = params.get('AsscociateId', '') or ''
                referred_by = params.get('Reffered by')
                relationship = params.get('Relationship')
                sponsors_org = params.get('Sponsors Org')
                beneficiary = params.get('Beneficiary', '') or ''
                client_phone = params.get('Phone', '') or ''
                taalk_campaign = params.get('Taalk_Campaign', '') or ''
                taalk_session = params.get('Taalk_Session', '') or ''
                
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
                
                success_count += 1
                
                if row_num % 2000 == 0:
                    print(f"Processed {row_num} rows... (success: {success_count}, errors: {error_count})")
                    conn.commit()
                    
            except Exception as e:
                error_count += 1
                if error_count < 5:  # Show first 5 errors only
                    print(f"Error processing row {row_num}: {e}")
                continue
    
    # Final commit
    conn.commit()
    print(f"Import complete! Total rows processed: {row_count}")
    print(f"Successful imports: {success_count}")
    print(f"Errors: {error_count}")
    
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
    
    # Show sample CONNECT events with full client data
    print(f"\nSample CONNECT events with full client data:")
    cur.execute("""
        SELECT 
            event_date, 
            agent_id, 
            first_name || ' ' || last_name as client_name,
            phone as client_phone,
            email,
            address,
            city,
            state,
            market
        FROM vdp_events_complete 
        WHERE event_type = 'CONNECT' 
        AND first_name != '' 
        ORDER BY event_date DESC
        LIMIT 10
    """)
    
    connect_samples = cur.fetchall()
    for i, row in enumerate(connect_samples):
        print(f"  {i+1}. {row[0]} | Agent {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]}, {row[6]} {row[7]} | {row[8]}")

if __name__ == "__main__":
    import_vdp_data()
    cur.close()
    conn.close()