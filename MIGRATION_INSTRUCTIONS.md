# 🚀 AI Validation Database Migration

## Problem
The AI flagging system isn't showing up because the database is missing the required columns.

## Solution: Run This SQL in Supabase

### Step 1: Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/ycztjetxwpfgtrzeyytt/sql

### Step 2: Copy and Paste This SQL

```sql
-- Add AI validation columns to verification_sessions table

-- Add screenshot_url if it doesn't exist
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- Add screenshot_validation jsonb column
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_validation JSONB;

-- Add recording_url if it doesn't exist  
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Add audio_analysis jsonb column
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS audio_analysis JSONB;

-- Add index for faster queries on validated screenshots
CREATE INDEX IF NOT EXISTS idx_verification_sessions_screenshot_validation 
ON verification_sessions USING GIN (screenshot_validation);

-- Add index for faster queries on audio analysis
CREATE INDEX IF NOT EXISTS idx_verification_sessions_audio_analysis 
ON verification_sessions USING GIN (audio_analysis);

-- Update existing sessions that have screenshot_path to populate screenshot_url
UPDATE verification_sessions 
SET screenshot_url = screenshot_path
WHERE screenshot_path IS NOT NULL 
  AND screenshot_url IS NULL;

COMMENT ON COLUMN verification_sessions.screenshot_validation IS 'AI validation results for uploaded screenshots (GPT-4o Vision analysis)';
COMMENT ON COLUMN verification_sessions.audio_analysis IS 'AI analysis results for call recordings (Whisper + GPT-4o)';
```

### Step 3: Click "Run"

### Step 4: Verify
Run this to check it worked:
```sql
SELECT 
  session_id, 
  screenshot_url, 
  screenshot_validation, 
  recording_url,
  audio_analysis
FROM verification_sessions 
LIMIT 5;
```

## What This Does
- ✅ Adds `screenshot_url` column (stores Supabase screenshot URLs)
- ✅ Adds `screenshot_validation` JSONB column (stores AI analysis)
- ✅ Adds `recording_url` column (stores call recording URLs)
- ✅ Adds `audio_analysis` JSONB column (stores audio AI analysis)
- ✅ Creates indexes for fast queries
- ✅ Migrates existing screenshot_path data to screenshot_url

## After Migration
1. Existing screenshots will get AI analyzed on next upload
2. Or run `node analyze-all-existing-sessions.cjs` to analyze everything now
3. Color-coded flags will appear in AOI Precheck Admin!

## Troubleshooting
If you get an error, the columns might already exist (which is fine!). Just verify with the SELECT query above.

