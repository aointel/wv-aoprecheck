# Timer Debug Guide - How Lead Send Timer Works

## Overview
There are **TWO separate timers** that send leads after enough time:

### 1. **60-Second Webhook Timer** (Frontend)
- **When it starts**: When a hotlead call is answered (status = 'answered')
- **What it does**: Sends webhook to Zapier after 60 seconds
- **Webhook URL**: `https://hooks.zapier.com/hooks/catch/2467580/urpd14m/`
- **Location**: `OutboundDialerInterface.tsx` line ~3918

### 2. **90-Second Auto-Assign Timer** (Frontend)
- **When it starts**: When call status = 'connected' (call timer starts)
- **What it does**: Auto-assigns hotlead to producer after 90 seconds
- **API Endpoint**: `/api/hotleads/assign-to-producer`
- **Location**: `OutboundDialerInterface.tsx` line ~3820

## How to Verify Timer is Working

### Console Logs to Look For:

#### When Timer Starts (60-second):
```
🔥 HOTLEAD CALL ANSWERED - Starting 60-second webhook timer
⏰ SETTING 60-SECOND TIMER: leadId=XXX, userEmail=XXX, associateId=XXX
⏰ TIMER START TIME: [timestamp]
⏰ TIMER WILL FIRE AT: [timestamp + 60s]
✅✅✅ 60-SECOND TIMER STARTED ✅✅✅
✅ Timer ID: [number]
```

#### When Timer Fires (60-second):
```
🚨🚨🚨 60-SECOND TIMER FIRED! 🚨🚨🚨
⏰ TIMER FIRE TIME: [timestamp]
⏰ ACTUAL ELAPSED: [ms] (expected: 60000ms)
📤📤📤 60-SECOND WEBHOOK (REAL ANSWERED): Sending to Zapier
✅✅✅ 60-SEC WEBHOOK SUCCESS! ✅✅✅
```

#### When 90-Second Timer Fires:
```
🚨🚨🚨 90-SECOND TRIGGER ACTIVATED FOR HOTLEAD! 🚨🚨🚨
🔥 HOTLEAD 1.5-MINUTE RULE: Auto-assigning lead to producer
🔥 Call Duration: 90 seconds
✅✅✅ HOTLEAD AUTO-ASSIGN SUCCESS
```

### Debug Logs Every 15 Seconds:
```
🔍 DETAILED CALL DEBUG: duration: [X]s, status: connected
🔥 HOTLEAD CHECK: {
  leadName: "...",
  isHotLead: true/false,
  market: "...",
  source_table: "..."
}
```

## Common Issues & Fixes

### Issue 1: Timer Gets Cleared Prematurely
**Symptom**: Timer starts but never fires
**Fix Applied**: Timer no longer clears on effect cleanup - it will complete even if component re-renders

### Issue 2: Timer Only Fires at Exact 90 Seconds
**Symptom**: If component re-renders at 89.5s, timer misses 90s
**Fix Applied**: Changed from `=== 90` to `>= 90 && < 95` to ensure it fires

### Issue 3: Timer Doesn't Start
**Check**:
1. Is it a hotlead? (`source_table === 'hotleads'` OR `market === 'Hot Lead'` OR `isHotLead === true`)
2. Is call status 'answered'? (Check Twilio webhook)
3. Is `webhookTimerStarted` false? (prevents duplicate timers)
4. Is `webhookTimerRef.current` null? (prevents duplicate timers)

## Testing Steps

1. **Start a call to a hotlead**
2. **Wait for call to be answered** - Look for: `📞 REAL TWILIO WEBHOOK: Call answered!`
3. **Verify timer started** - Look for: `✅✅✅ 60-SECOND TIMER STARTED ✅✅✅`
4. **Wait 60 seconds** - Watch console for timer fire
5. **Verify webhook sent** - Look for: `✅✅✅ 60-SEC WEBHOOK SUCCESS! ✅✅✅`
6. **Wait 90 seconds total** - Look for: `🚨🚨🚨 90-SECOND TRIGGER ACTIVATED`

## Backend Timer (Alternative)

There's also a backend timer in `server/hotlead-scheduler.ts` that:
- Runs every 5 minutes
- Checks for completed calls >= 60 seconds
- Sends webhook if not already sent

This is a backup in case frontend timer fails.

## Key Files

- `client/src/components/outbound-dialer/OutboundDialerInterface.tsx` - Main timer logic
- `server/hotlead-scheduler.ts` - Backend backup timer
- `server/twilio-status-webhook.ts` - Twilio webhook handler

