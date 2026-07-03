#!/usr/bin/env python3

import csv
import psycopg2
import os
import json
from urllib.parse import urlparse
from datetime import datetime, timedelta

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')

def parse_time(date_str, time_str):
    """Parse date and time into datetime object"""
    # Convert time format from "5:22:09 PM" to 24-hour format
    dt_str = f"{date_str} {time_str}"
    return datetime.strptime(dt_str, "%m/%d/%Y %I:%M:%S %p")

def process_vdp_connects():
    """Process VDP CSV to find actual connects (PICK_UP -> END > 12 seconds)"""
    
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
    
    print("🔄 Processing VDP CSV for actual connects (PICK_UP -> END > 12 seconds)...")
    
    # Create connects table
    cursor.execute("DROP TABLE IF EXISTS vdp_connects CASCADE;")
    
    create_table_sql = '''
    CREATE TABLE vdp_connects (
        id SERIAL PRIMARY KEY,
        connect_date DATE,
        pickup_time TIME,
        end_time TIME,
        duration_seconds INTEGER,
        agent_id VARCHAR(50),
        phone VARCHAR(20),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(10),
        market VARCHAR(100),
        lead_id VARCHAR(100),
        secret_key VARCHAR(255),
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    '''
    
    cursor.execute(create_table_sql)
    print("✅ Created vdp_connects table")
    
    # Read CSV and track phone events
    csv_file = 'attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757184471441.csv'
    
    phone_events = {}  # Track events by phone number
    
    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)  # Skip header
        
        for row in reader:
            if len(row) < 6:
                continue
                
            date = row[0]
            time = row[1] 
            event = row[2]
            phone = row[3]
            agent = row[4]
            params = row[5]
            
            if not phone:
                continue
                
            # Initialize phone tracking
            if phone not in phone_events:
                phone_events[phone] = []
            
            # Store all events for this phone
            phone_events[phone].append({
                'date': date,
                'time': time,
                'event': event,
                'agent': agent,
                'params': params
            })
    
    print(f"📞 Tracking events for {len(phone_events)} unique phone numbers")
    
    # Find connects (PICK_UP -> END > 12 seconds)
    connects_found = 0
    
    for phone, events in phone_events.items():
        # Sort events by time
        events.sort(key=lambda x: parse_time(x['date'], x['time']))
        
        # Look for PICK_UP followed by END
        for i in range(len(events)):
            if events[i]['event'] == 'PICK_UP':
                pickup_event = events[i]
                pickup_time = parse_time(pickup_event['date'], pickup_event['time'])
                
                # Look for corresponding END event
                for j in range(i + 1, len(events)):
                    if events[j]['event'] == 'END':
                        end_event = events[j]
                        end_time = parse_time(end_event['date'], end_event['time'])
                        
                        # Calculate duration
                        duration = (end_time - pickup_time).total_seconds()
                        
                        # Only count if > 12 seconds
                        if duration > 12:
                            # Extract client data from params
                            try:
                                if pickup_event['params'] and pickup_event['params'].strip():
                                    params_data = json.loads(pickup_event['params'])
                                    first_name = params_data.get('First Name', '')
                                    last_name = params_data.get('Last Name', '')
                                    email = params_data.get('Email', '')
                                    address = params_data.get('Address', '')
                                    city = params_data.get('City', '')
                                    state = params_data.get('State', '')
                                    market = params_data.get('Market', '')
                                    lead_id = params_data.get('Leadid', '')
                                    secret_key = params_data.get('Secretkey', '')
                                else:
                                    first_name = last_name = email = address = city = state = market = lead_id = secret_key = ''
                            except Exception as e:
                                print(f"JSON parse error for {phone}: {e}")
                                first_name = last_name = email = address = city = state = market = lead_id = secret_key = ''
                            
                            # Insert connect record
                            insert_sql = '''
                            INSERT INTO vdp_connects 
                            (connect_date, pickup_time, end_time, duration_seconds, agent_id, phone,
                             first_name, last_name, email, address, city, state, market, lead_id, secret_key)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            '''
                            
                            cursor.execute(insert_sql, (
                                pickup_event['date'],
                                pickup_time.time(),
                                end_time.time(),
                                int(duration),
                                pickup_event['agent'],
                                phone,
                                first_name,
                                last_name,
                                email,
                                address,
                                city,
                                state,
                                market,
                                str(lead_id),
                                secret_key
                            ))
                            
                            connects_found += 1
                            if connects_found % 50 == 0:
                                print(f"📈 Found {connects_found} billable connects...")
                                conn.commit()
                        
                        # Use first END event found
                        break
    
    # Create indexes
    cursor.execute("CREATE INDEX idx_vdp_connects_agent_id ON vdp_connects(agent_id);")
    cursor.execute("CREATE INDEX idx_vdp_connects_phone ON vdp_connects(phone);")
    cursor.execute("CREATE INDEX idx_vdp_connects_date ON vdp_connects(connect_date);")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ VDP connects processing complete!")
    print(f"📊 Total billable connects found: {connects_found}")
    print(f"⏱️ All connects have duration > 12 seconds")

if __name__ == "__main__":
    process_vdp_connects()