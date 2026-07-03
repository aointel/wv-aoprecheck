#!/usr/bin/env python3

import csv
import psycopg2
import os
from urllib.parse import urlparse
from datetime import datetime

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')

def parse_time(date_str, time_str):
    """Parse date and time into datetime object"""
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
    
    # Create connects table - just copy the entire row data
    cursor.execute("DROP TABLE IF EXISTS vdp_connects CASCADE;")
    
    create_table_sql = '''
    CREATE TABLE vdp_connects (
        id SERIAL PRIMARY KEY,
        connect_date VARCHAR(20),
        pickup_time VARCHAR(20),
        end_time VARCHAR(20),
        duration_seconds INTEGER,
        event_type VARCHAR(20),
        phone VARCHAR(20),
        agent_id VARCHAR(50),
        params TEXT,
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
            
            # Store complete row data for this phone
            phone_events[phone].append({
                'date': date,
                'time': time,
                'event': event,
                'agent': agent,
                'params': params,
                'full_row': row
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
                            # Insert connect record - just copy the PICK_UP row data
                            insert_sql = '''
                            INSERT INTO vdp_connects 
                            (connect_date, pickup_time, end_time, duration_seconds, event_type, phone, agent_id, params)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            '''
                            
                            cursor.execute(insert_sql, (
                                pickup_event['date'],
                                pickup_event['time'],
                                end_event['time'],
                                int(duration),
                                pickup_event['event'],
                                phone,
                                pickup_event['agent'],
                                pickup_event['params']
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
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ VDP connects processing complete!")
    print(f"📊 Total billable connects found: {connects_found}")
    print(f"⏱️ All connects have duration > 12 seconds")

if __name__ == "__main__":
    process_vdp_connects()