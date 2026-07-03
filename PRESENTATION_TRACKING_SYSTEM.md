# 🎬 Presentation Tracking & Analytics System

## Overview
Complete system for tracking agent presentations with full video recording, real-time AI analysis, and manager dashboards.

## ✅ What's Implemented

### 1. **Full Video Recording**
- Records entire presentation as `.webm` video file
- Captures screen + system audio
- Auto-uploads when presentation ends
- Stored in `uploads/presentations/`

### 2. **Screenshot AI Analysis**
- Captures screenshot every 30 seconds
- Sends to GPT-4o-mini Vision API
- Analyzes slide content in real-time
- **Cost: ~$0.24 per 40-min presentation**

### 3. **Real-Time Tracking**
- Managers see live presentations
- Track which slide agent is on
- Monitor presentation progress
- View active sessions dashboard

### 4. **Manager Review**
- Watch full video recordings
- Review AI-analyzed screenshots
- See presentation KPIs:
  - Total duration
  - Slides shown
  - Products covered
  - Quality score
  - AI summary

## 💰 Cost Breakdown

| Component | Cost per 40-Min Presentation |
|-----------|------------------------------|
| Video Storage | $0.02/month |
| AI Analysis (80 screenshots) | $0.24 one-time |
| **Total** | **$0.24 + $0.02/month** |

### Volume Pricing
- **1,000 presentations/month:** ~$240/month + $20 storage
- **100 presentations/month:** ~$24/month + $2 storage

## 🎯 Features

### For Agents:
- Transparent - know they're being recorded
- No extra steps required
- Automatic capture when HPPRO opens

### For Managers:
- **Live View:** See all active presentations
- **Historical Review:** Watch any past presentation
- **AI Insights:** Automatic analysis of what was presented
- **Accountability:** Full evidence of presentation content
- **Training:** Use best presentations as examples

## 🗂️ Database Schema

### `presentation_sessions`
```sql
- session_id (UUID)
- agent_email
- agent_name
- video_url (full recording)
- video_uploaded_at
- started_at / ended_at
- duration_seconds
- status (active/completed/abandoned)
- ai_summary
```

### `presentation_screenshots`
```sql
- session_id (FK)
- screenshot_data (base64)
- captured_at
- sequence_number
- ai_analysis (JSON)
```

### `presentation_kpis`
```sql
- session_id (FK)
- total_slides
- avg_time_per_slide
- products_covered
- quality_score
- engagement_score
```

### `live_presentations`
```sql
- session_id (FK)
- current_slide_title
- last_activity
- viewer_count
- viewers (JSON array)
```

## 📡 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/presentations/start` | POST | Start new session |
| `/api/presentations/screenshot` | POST | Upload screenshot for AI |
| `/api/presentations/upload-video` | POST | Upload full video |
| `/api/presentations/end` | POST | End session |
| `/api/presentations/active` | GET | Get live presentations |
| `/api/presentations/:sessionId` | GET | Get session details |
| `/api/presentations/agent/:email` | GET | Get agent history |

## 🔧 Technical Details

### Frontend (`client/src/components/screen-share/ElectronAutoCapture.tsx`)
- Captures screen via Electron's `desktopCapturer`
- Records video using `MediaRecorder` API
- Takes screenshots every 30 seconds
- Uploads to backend when session ends

### Backend (`server/presentation-tracker.ts`)
- Manages session lifecycle
- Stores screenshots and video
- Triggers AI analysis
- Calculates KPIs

### AI Analysis (`server/presentation-ai-analyzer.ts`)
- Uses GPT-4o-mini Vision API
- Low-detail mode for cost savings
- Extracts:
  - Slide titles
  - Products mentioned
  - Key points
  - Quality metrics

## 🚀 How to Use

### For Agents:
1. Open Electron app (sign in if needed)
2. Click HPPRO button
3. Give presentation normally
4. System auto-records everything
5. Close window when done

### For Managers:
1. Go to **Live Presentations** dashboard
   - See all active presentations
   - View real-time progress
   
2. Go to **Presentation Review** dashboard
   - Search by agent/date
   - Watch full video
   - Review AI analysis
   - See KPIs

## 🎓 Use Cases

### 1. **Quality Assurance**
- Verify complete presentations
- Ensure all products covered
- Check presentation quality

### 2. **Compliance**
- Proof of what was shown to client
- Audit trail for disputes
- Verify correct information presented

### 3. **Training**
- Show new agents examples
- Identify best practices
- Coach improvement areas

### 4. **Performance**
- Track presentation completion rates
- Measure effectiveness
- Compare agent performance

## 📊 Next Steps

**Ready to Test:**
1. Wait for Electron app to start (~10 seconds)
2. Click HPPRO button
3. Watch terminal for:
   - `💾 Stored user email for presentation tracking: cnsysop@aoglobelife.com`
   - `🔴 Video recording started`
   - `📸 Captured screenshot`
   - `🤖 Analyzing slide with GPT-4o-mini Vision...`
4. Close HPPRO window
5. Watch for:
   - `⏹️ Stopped video recording`
   - `📤 Uploading video: XX MB`
   - `✅ Video uploaded successfully`

## 🎉 System Complete!

**Cost-effective presentation tracking that gives managers full visibility into agent presentations for less than 25 cents per session!**
