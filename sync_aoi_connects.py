#!/usr/bin/env python3
import psycopg2
import os
from datetime import datetime

def main():
    print("🔄 Starting AOI Connect sync from Supabase vdp_calls...")
    
    # Connect to database
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get all VDP calls with complete client data
    print("📊 Fetching VDP calls from Supabase...")
    cur.execute('''
        SELECT id, "Date", "Time", "Event", "Phone", "Agent", duration, leadid, firstname, lastname, market
        FROM vdp_calls 
        WHERE leadid IS NOT NULL 
        AND firstname IS NOT NULL 
        AND lastname IS NOT NULL 
        AND market IS NOT NULL 
        AND market != 'NO_CLIENT_DATA'
        ORDER BY id DESC
    ''')
    
    vdp_calls = cur.fetchall()
    print(f"📊 Found {len(vdp_calls)} complete VDP calls")
    
    synced = 0
    errors = 0
    
    for call in vdp_calls:
        try:
            call_id, date_str, time_str, event, phone, agent, duration, leadid, firstname, lastname, market = call
            
            # Check if already synced
            cur.execute('SELECT id FROM aoi_connects WHERE supabase_vdp_id = %s', (call_id,))
            if cur.fetchone():
                continue  # Already synced
            
            # Create client name
            client_name = f"{firstname} {lastname}".strip()
            
            # Insert new AOI connect record
            cur.execute('''
                INSERT INTO aoi_connects 
                (agent_id, supabase_vdp_id, client_phone, client_name, first_name, last_name, 
                 lead_id, market, call_date, call_time, duration, billing_amount, billed, notified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                agent, call_id, phone, client_name, firstname, lastname,
                leadid, market, date_str, time_str, duration, 8.00, False, False
            ))
            
            synced += 1
            
            if synced % 50 == 0:
                print(f"   ✅ Synced {synced} AOI connects...")
                conn.commit()
                
        except Exception as e:
            print(f"❌ Error syncing VDP call {call_id}: {e}")
            errors += 1
            continue
    
    # Final commit
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"✅ AOI Connect sync complete: {synced} synced, {errors} errors")
    return synced, errors

if __name__ == "__main__":
    synced, errors = main()
    print(f"\n🎯 AOI_CONNECTS TABLE UPDATED: {synced} new records synced!")
    print("💳 Agent billing system now has complete AOI connect data!")