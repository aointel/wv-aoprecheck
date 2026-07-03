# New Leads Notification System

## 🎉 Overview
A full-screen popup notification that appears when new leads are added to an agent's Call Connector Pro queue.

## 🚀 When It Triggers

### Automatic Triggers:
1. **When leads are auto-assigned** - When the system automatically assigns new leads to an agent
2. **When leads are manually loaded** - When an agent clicks "Load Leads" or "Get Started" and receives new leads
3. **When leads refresh** - When the auto-refresh interval detects new leads in the queue
4. **When webhook assigns leads** - When the auto-assignment webhook adds new leads

### Conditions:
- ✅ Only triggers if the agent **already had leads** (previousLeadCount > 0)
- ✅ Only triggers when lead count **increases** (currentCount > previousCount)
- ❌ Does NOT trigger on initial page load (when agent has 0 leads)
- ❌ Does NOT trigger when leads decrease

## 🧪 Testing

### Test Button:
- **Location**: Top header of Call Connector Pro (purple "🎉 Test Notification" button)
- **Function**: Manually triggers the notification with a random lead count (1-20)
- **Use Case**: Test the notification without waiting for actual new leads

## 📦 Deployment

### Files Changed:
1. `client/src/components/outbound-dialer/NewLeadsNotification.tsx` - New component
2. `client/src/components/outbound-dialer/CallConnectorPro.tsx` - Integrated notification tracking

### To Deploy:
```bash
# Build the client
cd client
npm run build

# Deploy to dev server (your deployment process)
# The notification will automatically work once deployed
```

## 🎨 Features

### Visual Elements:
- **Full-screen backdrop** - Dark overlay with blur effect
- **Centered modal** - Large card with gradient background (blue → purple → indigo)
- **Animated particles** - Floating sparkles in background
- **Rotating rocket icon** - Pulsing animation
- **Large lead count** - 8xl font size showing "+X fresh leads"
- **Progress bar** - Countdown timer (6 seconds)

### User Interaction:
- **Click backdrop** - Dismisses notification
- **Click X button** - Dismisses notification
- **Auto-dismiss** - Automatically closes after 6 seconds

## 🔧 Technical Details

### Lead Count Tracking:
- Uses `useRef` to track previous lead count
- Compares `rawLeads.length` on each render
- Updates ref after notification is shown

### React Query Integration:
- Works with existing `useQuery` for leads
- Respects `refetchInterval` (10s for <50 leads, 30s for >=50 leads)
- Triggers on `refetch()` calls

## 📝 Code Location

- **Component**: `client/src/components/outbound-dialer/NewLeadsNotification.tsx`
- **Integration**: `client/src/components/outbound-dialer/CallConnectorPro.tsx` (lines 302-330, 715-724, 1520-1531)

## 🐛 Troubleshooting

### Notification not showing?
1. Check if agent has existing leads (won't trigger on first load)
2. Check browser console for errors
3. Verify `framer-motion` is installed (already in project)
4. Check that lead count actually increased

### Test button not working?
1. Ensure you have at least 1 lead loaded
2. Check browser console for errors
3. Verify button is visible in header

## 🎯 Future Enhancements

Potential improvements:
- Sound effect when notification appears
- Different animations for different lead counts
- Show which markets the new leads are from
- Show lead quality/priority indicators

