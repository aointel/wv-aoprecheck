-- Add separate ALP columns by origin. Run in Supabase SQL editor (run the whole block).
-- Safe to run multiple times (adds columns only if missing).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submitted_applications' AND column_name = 'aoi_alp') THEN
    ALTER TABLE submitted_applications ADD COLUMN aoi_alp NUMERIC(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submitted_applications' AND column_name = 'ccpro_alp') THEN
    ALTER TABLE submitted_applications ADD COLUMN ccpro_alp NUMERIC(12,2);
  END IF;
END $$;

-- Backfill from existing alp for already-matched rows
UPDATE submitted_applications SET aoi_alp = alp WHERE transfer_type = 'aoi_connect';
UPDATE submitted_applications SET ccpro_alp = alp WHERE transfer_type IN ('ccpro_booked', 'ccpro_reached');
