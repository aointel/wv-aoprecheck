#!/usr/bin/env python3

import csv
import psycopg2
import os
import re
import json
from urllib.parse import urlparse

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')

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

def continue_vdp_import():
    """Continue processing VDP CSV from where we left off"""
    
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
    
    print("🔄 Continuing VDP CSV processing from record 3001...")
    
    # Read and process CSV starting from record 3001
    csv_file = '/tmp/vdp_complete.csv'
    
    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        
        # Skip header + first 3000 records
        for _ in range(3001):
            next(reader, None)
        
        processed_count = 3000  # Starting count
        with_names_count = 2248  # Starting count with names
        batch_size = 500  # Smaller batch for faster processing
        batch_data = []
        
        for row_num, row in enumerate(reader, 3001):
            if len(row) < 5:  # Skip incomplete rows
                continue
                
            try:
                # Extract basic fields
                event_date = row[0] if len(row) > 0 else None
                event_time = row[1] if len(row) > 1 else None
                agent_id = row[2] if len(row) > 2 else None
                phone = row[3] if len(row) > 3 else None
                event_type = row[4] if len(row) > 4 else None
                
                # Get raw parameters
                raw_params = ''
                if len(row) > 5:
                    raw_params = row[5]
                
                # Extract client info
                first_name, last_name = extract_client_name(raw_params)
                
                # Extract additional fields from parameters
                email = None
                address = None
                city = None
                state = None
                market = None
                
                if raw_params:
                    # Extract email
                    email_match = re.search(r'"?[Ee]mail"?\s*:\s*"([^"]+)"', raw_params)
                    if email_match:
                        email = email_match.group(1)
                    
                    # Extract market from campaign
                    market_match = re.search(r'VDP_([^_]+)', raw_params)
                    if market_match:
                        market = market_match.group(1)
                
                # Add to batch
                batch_data.append((
                    event_date, event_time, agent_id, phone, first_name, last_name,
                    email, address, city, state, market, None, None,
                    None, event_type, raw_params
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
                
                # Process in chunks of 5000 to avoid timeout
                if processed_count % 5000 == 0:
                    print(f"🎯 Checkpoint: {processed_count} records processed")
                    break
                
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
    
    cursor.close()
    conn.close()
    
    print(f"✅ VDP processing chunk finished!")
    print(f"📊 Total records processed: {processed_count}")
    print(f"👥 Records with client names: {with_names_count}")

if __name__ == "__main__":
    continue_vdp_import()