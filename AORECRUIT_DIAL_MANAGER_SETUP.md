# AO Recruit Dial Manager - Setup Complete ✅

## What Was Implemented

A new service that **automatically adjusts the `aorecruittest` Taalk campaign's dials per hour based on the number of active agents**.

### Formula
```
Dials Per Hour = Number of Active Agents × 400
```

### How It Works

1. **Agent Tracking**: When agents open the AO Recruit page, they send a heartbeat every 10 seconds to `/api/ao-recruit/heartbeat`

2. **Activity Detection**: The `recruitTracker` tracks which agents are actively on the AO Recruit page (considers them active if heartbeat received within last 2 minutes)

3. **Auto-Adjustment**: The Dial Manager checks active agents every 30 seconds and updates the campaign dials per hour automatically

4. **Campaign Update**: Updates are sent to Taalk API: `PUT https://api.taalk.ai/api/campaign2s/{campaignId}`

## Files Created/Modified

### New Files:
- ✅ `server/aorecruit-dial-manager.ts` - The dial manager service
- ✅ `get-aorecruittest-campaign-id.sql` - SQL query to find campaign ID

### Modified Files:
- ✅ `server/index.ts` - Added service startup (lines 573-577)
- ✅ `client/src/components/routes.tsx` - Removed Live Call Board from default routes
- ✅ `client/src/components/layouts/dashboard-layout.tsx` - Added Live Call Board only for MGAs/RGAs

## 🚨 ACTION REQUIRED: Get Campaign ID

The service is **running but needs the correct campaign ID**. Currently using placeholder `"aorecruittest"`.

### Option 1: Via Taalk Campaign Manager UI
1. Navigate to `/dashboard/campaign-manager`
2. Find the "aorecruittest" campaign
3. Copy its ID (looks like `6747819a86c131c2cb203719`)

### Option 2: Via Supabase
```sql
SELECT id, name, agent, total_calls
FROM taalk_campaigns
WHERE LOWER(name) LIKE '%aorecruittest%'
ORDER BY created_at DESC;
```

### Option 3: Via Taalk API
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4" \
  "https://api.taalk.ai/api/campaign2s?db=michaelmandella" | grep -i "aorecruittest"
```

### Update the Campaign ID:
Edit `server/aorecruit-dial-manager.ts` line 17:
```typescript
const AORECRUITTEST_CAMPAIGN_ID = "YOUR_ACTUAL_CAMPAIGN_ID_HERE";
```

## Monitoring

### Server Logs
When the service runs, you'll see:
```
✅ AO Recruit Dial Manager started - adjusting aorecruittest campaign dials per hour (400 per agent)
👥 Active AO Recruit Agents: 3
📞 Setting aorecruittest campaign to 1200 dials/hour (3 agents × 400)
   Active agents: user1@example.com, user2@example.com, user3@example.com
✅ Successfully updated aorecruittest campaign to 1200 dials/hour
```

### Status Endpoint
To check current status, you can add a route:
```typescript
app.get('/api/ao-recruit/dial-manager/status', (req, res) => {
  res.json(aoRecruitDialManager.getStatus());
});
```

## Examples

| Active Agents | Dials Per Hour |
|--------------|----------------|
| 0            | 0              |
| 1            | 400            |
| 2            | 800            |
| 3            | 1200           |
| 5            | 2000           |
| 10           | 4000           |

## Testing

1. **Start the server**: `npm run dev`
2. **Open AO Recruit**: Navigate to `/dashboard/ao-recruit` as an agent
3. **Check logs**: You should see heartbeat logs and dial adjustments
4. **Verify campaign**: Check Taalk dashboard to see the campaign dials per hour updating

## Bonus: Live Call Board Hidden

As requested, **Live Call Board is now hidden from all regular agents** and only visible to MGAs/RGAs.

## Next Steps

1. ✅ Get the actual `aorecruittest` campaign ID
2. ✅ Update `AORECRUITTEST_CAMPAIGN_ID` in `server/aorecruit-dial-manager.ts`
3. ✅ Restart the server
4. ✅ Test with multiple agents opening AO Recruit
5. ✅ Monitor logs to confirm it's working






