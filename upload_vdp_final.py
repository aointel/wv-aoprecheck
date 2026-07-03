#!/usr/bin/env python3
import pandas as pd
import psycopg2
import os

def main():
    print("🔥 UPLOADING ENRICHED VDP CSV TO SUPABASE vdp_calls TABLE...")
    
    # Read the enriched CSV file
    csv_file = 'attached_assets/vdp_connects_enriched_from_params_1757198027565.csv'
    print(f"📊 Reading enriched CSV: {csv_file}")
    
    df = pd.read_csv(csv_file)
    print(f"📊 Loaded {len(df)} records from enriched CSV")
    
    # Connect to database
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Clear existing vdp_calls table
    print("🗑️ Clearing existing vdp_calls table...")
    cur.execute("DELETE FROM vdp_calls")
    conn.commit()
    
    # Insert all enriched records in batches
    print("💾 Inserting enriched records into vdp_calls table...")
    
    inserted_count = 0
    complete_records = 0
    batch_size = 50
    
    for index, row in df.iterrows():
        try:
            # Extract data from enriched CSV
            date_str = str(row.get('Date', '')) if pd.notna(row.get('Date')) else ''
            pickup_time = str(row.get('PickupTime', '')) if pd.notna(row.get('PickupTime')) else ''
            duration = str(row.get('Duration', '')) if pd.notna(row.get('Duration')) else ''
            agent = str(row.get('Agent', '')) if pd.notna(row.get('Agent')) else ''
            phone = str(row.get('Phone', '')) if pd.notna(row.get('Phone')) else ''
            leadid = str(row.get('Leadid', '')) if pd.notna(row.get('Leadid')) else ''
            firstname = str(row.get('Firstname', '')) if pd.notna(row.get('Firstname')) else ''
            lastname = str(row.get('Lastname', '')) if pd.notna(row.get('Lastname')) else ''
            market = str(row.get('Market', '')) if pd.notna(row.get('Market')) else ''
            
            # Count complete records
            if leadid and firstname and market:
                complete_records += 1
            
            # Insert into vdp_calls table using EXACT column names from schema
            cur.execute('''
                INSERT INTO vdp_calls 
                ("Date", "Time", "Event", "Phone", "Agent", duration, leadid, firstname, lastname, market)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                date_str,
                pickup_time,
                'CONNECT',  # Event type
                phone, 
                agent,
                duration,
                leadid if leadid else None,
                firstname if firstname else None,
                lastname if lastname else None,
                market if market else None
            ))
            
            inserted_count += 1
            
            # Commit every batch
            if inserted_count % batch_size == 0:
                conn.commit()
                print(f"   ✅ Inserted {inserted_count} records...")
                
        except Exception as e:
            print(f"❌ Error inserting row {index}: {e}")
            conn.rollback()
            continue
    
    # Final commit
    conn.commit()
    cur.close()
    conn.close()
    
    success_rate = (complete_records/inserted_count)*100 if inserted_count > 0 else 0
    
    print(f"\n✅ ENRICHED VDP DATA UPLOAD COMPLETE!")
    print(f"   📊 Total Records Inserted: {inserted_count}")
    print(f"   ✅ Complete Client Data: {complete_records}")
    print(f"   🚀 Success Rate: {success_rate:.1f}%")
    print(f"   💰 Ready for $8.00 AOI_CONNECT billing!")
    
    return inserted_count, complete_records

if __name__ == "__main__":
    inserted, complete = main()
    print(f"\n🎯 VDP_CALLS TABLE UPDATED: {complete}/{inserted} records with complete client data!")
    print("💳 System ready for accurate agent billing at $8.00 per connect")