# Automated Recording Download System

## Overview
The system automatically downloads verification call recordings from Taalk every 5 minutes and stores them in Supabase Storage.

## How It Works

### Background Scheduler
- **File**: `server/recording-scheduler.ts`
- **Frequency**: Checks every 5 minutes (300 seconds)
- **Target**: Completed verification sessions from the last 48 hours
- **Process**:
  1. Queries for completed sessions without stored recordings
  2. Downloads MP3 files from Taalk API
  3. Uploads to Supabase Storage (`verify_agent_screenshot` bucket)
  4. Generates signed URLs (1-hour expiry)
  5. Updates `verification_sessions` table

### Integration
The scheduler starts automatically when the server starts:
- Integrated into `server/index.ts`
- Runs as a deferred background service
- Non-blocking - doesn't affect server startup
- Logs all activity with timestamps

### Recording Lifecycle

1. **Call Completed**: Taalk webhook fires when verification call ends
2. **Immediate Download**: Webhook tries to download recording right away
3. **Background Backup**: Scheduler checks every 5 minutes for any missed recordings
4. **48-Hour Window**: Taalk deletes recordings after 48 hours
5. **Permanent Storage**: Once in Supabase, recordings are stored permanently

### Monitoring

Check the server logs for scheduler activity:
```
🔄 [2:30:15 PM] Checking for new recordings...
✅ No new recordings to download
```

Or when recordings are found:
```
🔄 [2:35:20 PM] Checking for new recordings...
📥 Found 3 sessions to download
  ✅ Downloaded VER-1760736040359-2EN9qV (378KB)
  ✅ Downloaded VER-1760728689371-a779s2 (235KB)
  ✅ Downloaded VER-1760727697615-jhHsJL (2.1MB)
📊 Summary: ✅ 3 downloaded, ❌ 0 failed
```

### Current Status

**Total Recordings Stored**: 268 sessions
**Missing Recordings**: 15 sessions (all older than 48 hours - cannot be recovered)
**Auto-Download**: ✅ Active - running every 5 minutes

### Key Features

✅ **Automatic**: No manual intervention required
✅ **Resilient**: Retries failed downloads on next check
✅ **Efficient**: Only checks last 48 hours (Taalk retention period)
✅ **Secure**: Generates fresh signed URLs on access
✅ **Non-Blocking**: Doesn't slow down server startup
✅ **Logged**: All activity visible in server console

### Technical Details

- **Storage**: Supabase S3-compatible bucket
- **Format**: MP3 audio files
- **Authentication**: Signed URLs with 1-hour expiry
- **Rate Limiting**: 100ms delay between downloads
- **Retry Logic**: Uses both Bearer token and Basic Auth
- **Memory**: Uses streams to avoid loading entire files into memory

### Troubleshooting

If recordings aren't being downloaded:
1. Check server logs for scheduler errors
2. Verify Taalk API credentials are valid
3. Ensure Supabase Storage bucket exists
4. Check that sessions have `taalk_call_id` populated
5. Verify recordings are less than 48 hours old

### Future Enhancements

Potential improvements:
- Email notifications for failed downloads
- Dashboard showing download statistics
- Configurable check frequency
- Retry queue for failed downloads
- Webhook fallback if scheduler misses a recording

