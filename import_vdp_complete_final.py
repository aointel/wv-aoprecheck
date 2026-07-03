#!/usr/bin/env python3

import csv
import psycopg2
import os
import re
import json
from urllib.parse import urlparse

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

def fix_malformed_json(text):
    """Fix malformed JSON by adding missing quotes"""
    if not text or text.strip() == '':
        return '{}'
    
    # Handle the specific malformed pattern: {First Name":"value"
    pattern = r'\{([A-Za-z\s]+)":"([^"]*)"'
    match = re.search(pattern, text)
    if match:
        key = match.group(1)
        value = match.group(2)
        return f'{{"{key}":"{value}"}}'
    
    # If it looks like JSON, try to parse it
    if text.startswith('{') and text.endswith('}'):
        try:
            json.loads(text)
            return text
        except:
            return '{}'
    
    return '{}'

def extract_client_name(params_text):
    """Extract client name from various parameter formats"""
    if not params_text:
        return None, None
    
    try:
        # Try to parse as JSON first
        params = json.loads(params_text)
        if isinstance(params, dict):
            first_name = params.get('First Name') or params.get('first_name')
            last_name = params.get('Last Name') or params.get('last_name') 
            if first_name:
                return first_name, last_name
    except:
        pass
    
    # Regex patterns for name extraction
    patterns = [
        r'"First Name"\s*:\s*"([^"]+)"',
        r'"first_name"\s*:\s*"([^"]+)"',
        r'First Name["\s]*:[\s"]*([^",}]+)',
        r'first_name["\s]*:[\s"]*([^",}]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, params_text, re.IGNORECASE)
        if match:
            first_name = match.group(1).strip()
            # Try to find last name
            last_patterns = [
                r'"Last Name"\s*:\s*"([^"]+)"',
                r'"last_name"\s*:\s*"([^"]+)"',
                r'Last Name["\s]*:[\s"]*([^",}]+)',
                r'last_name["\s]*:[\s"]*([^",}]+)'
            ]
            last_name = None
            for last_pattern in last_patterns:
                last_match = re.search(last_pattern, params_text, re.IGNORECASE)
                if last_match:
                    last_name = last_match.group(1).strip()
                    break
            return first_name, last_name
    
    return None, None

def process_vdp_csv():
    """Process the complete VDP CSV file"""
    
    # Parse database URL
    url = urlparse(DATABASE_URL)
    
    # Connect to database
    conn = psycopg2.connect(
        host=url.hostname,
        port=url.port,
        user=url.username,
        password=url.password,
        database=url.path[1:]
    )
    
    cursor = conn.cursor()
    
    print("🔄 Starting complete VDP CSV processing...")
    
    # Clear existing data and recreate table
    cursor.execute("DROP TABLE IF EXISTS vdp_events_complete CASCADE;")
    
    create_table_sql = '''
    CREATE TABLE vdp_events_complete (
        id SERIAL PRIMARY KEY,
        event_date DATE,
        event_time TIME,
        agent_id VARCHAR(50),
        phone VARCHAR(20),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(10),
        market VARCHAR(100),
        client_type VARCHAR(50),
        lead_id VARCHAR(100),
        secret_key VARCHAR(255),
        event_type VARCHAR(50),
        raw_params TEXT,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    '''
    
    cursor.execute(create_table_sql)
    print("✅ Created fresh vdp_events_complete table")
    
    # Read and process CSV
    csv_file = '/tmp/vdp_complete.csv'
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return
    
    with open(csv_file, 'r', encoding='utf-8') as file:
        # Skip header if present
        first_line = file.readline().strip()
        if 'agent' in first_line.lower() or 'event' in first_line.lower():
            print("📋 Header detected, skipping first line")
        else:
            file.seek(0)  # Reset to beginning if no header
        
        reader = csv.reader(file)
        
        processed_count = 0
        with_names_count = 0
        batch_size = 1000
        batch_data = []
        
        for row_num, row in enumerate(reader, 1):
            if len(row) < 5:  # Skip incomplete rows
                continue
                
            try:
                # Extract basic fields
                event_date = row[0] if len(row) > 0 else None
                event_time = row[1] if len(row) > 1 else None
                agent_id = row[2] if len(row) > 2 else None
                phone = row[3] if len(row) > 3 else None
                event_type = row[4] if len(row) > 4 else None
                
                # Get raw parameters (usually in column 5 or 6)
                raw_params = ''
                if len(row) > 5:
                    raw_params = row[5]
                elif len(row) > 6:
                    raw_params = row[6]
                
                # Fix malformed JSON and extract client info
                fixed_params = fix_malformed_json(raw_params)
                first_name, last_name = extract_client_name(raw_params)
                
                # Extract additional fields from parameters
                email = None
                address = None
                city = None
                state = None
                market = None
                client_type = None
                lead_id = None
                secret_key = None
                
                if raw_params:
                    # Extract email
                    email_match = re.search(r'"?[Ee]mail"?\s*:\s*"([^"]+)"', raw_params)
                    if email_match:
                        email = email_match.group(1)
                    
                    # Extract address
                    addr_match = re.search(r'"?[Aa]ddress"?\s*:\s*"([^"]+)"', raw_params)
                    if addr_match:
                        address = addr_match.group(1)
                    
                    # Extract city
                    city_match = re.search(r'"?[Cc]ity"?\s*:\s*"([^"]+)"', raw_params)
                    if city_match:
                        city = city_match.group(1)
                    
                    # Extract state
                    state_match = re.search(r'"?[Ss]tate"?\s*:\s*"([^"]+)"', raw_params)
                    if state_match:
                        state = state_match.group(1)
                    
                    # Extract market from campaign or market field
                    market_match = re.search(r'VDP_([^_]+)', raw_params)
                    if market_match:
                        market = market_match.group(1)
                
                # Add to batch
                batch_data.append((
                    event_date, event_time, agent_id, phone, first_name, last_name,
                    email, address, city, state, market, client_type, lead_id,
                    secret_key, event_type, raw_params
                ))
                
                if first_name:
                    with_names_count += 1
                
                processed_count += 1
                
                # Insert batch when full
                if len(batch_data) >= batch_size:
                    insert_sql = '''
                    INSERT INTO vdp_events_complete 
                    (event_date, event_time, agent_id, phone, first_name, last_name,
                     email, address, city, state, market, client_type, lead_id,
                     secret_key, event_type, raw_params)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    '''
                    cursor.executemany(insert_sql, batch_data)
                    conn.commit()
                    batch_data = []
                    print(f"📦 Processed {processed_count} records, {with_names_count} with client names")
                
            except Exception as e:
                print(f"⚠️ Error processing row {row_num}: {e}")
                continue
        
        # Insert remaining batch
        if batch_data:
            insert_sql = '''
            INSERT INTO vdp_events_complete 
            (event_date, event_time, agent_id, phone, first_name, last_name,
             email, address, city, state, market, client_type, lead_id,
             secret_key, event_type, raw_params)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            '''
            cursor.executemany(insert_sql, batch_data)
            conn.commit()
    
    # Create indexes for better performance
    cursor.execute("CREATE INDEX idx_vdp_agent_id ON vdp_events_complete(agent_id);")
    cursor.execute("CREATE INDEX idx_vdp_event_date ON vdp_events_complete(event_date);")
    cursor.execute("CREATE INDEX idx_vdp_phone ON vdp_events_complete(phone);")
    cursor.execute("CREATE INDEX idx_vdp_first_name ON vdp_events_complete(first_name);")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Complete VDP processing finished!")
    print(f"📊 Total records processed: {processed_count}")
    print(f"👥 Records with client names: {with_names_count}")
    print(f"📈 Name extraction rate: {(with_names_count/processed_count)*100:.1f}%")

if __name__ == "__main__":
    process_vdp_csv()