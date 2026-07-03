# AI Screenshot Validation System

## Overview

The AOI-precheck admin system now includes **AI-powered screenshot validation** to ensure agents submit valid verification screenshots showing both the agent and client on video calls.

## Features

### ✅ Automatic Validation
- **Real-time AI analysis** of all uploaded screenshots
- **Rejects invalid submissions** automatically (random photos, single person, no video interface)
- **Stores validation results** in the database for admin review

### 🎯 Validation Criteria

#### For ZOOM Verifications:
- ✓ Must show Zoom meeting interface (gallery view, toolbar, participant names)
- ✓ Must show at least 2 people visible (agent + client)
- ✓ Both people should be clearly visible with cameras on
- ✗ Rejects: Random photos, single person, no Zoom interface

#### For PHONE Verifications:
- ✓ Must show video call interface (FaceTime, WhatsApp Video, Zoom mobile, etc.)
- ✓ Must show at least 2 people or clear video call indicators
- ✓ Accepts any legitimate video conferencing app
- ✗ Rejects: Voice-only calls, random photos, single person with no video interface

### 🤖 AI Analysis Details

The system provides detailed analysis including:
- **Validation Status**: Valid or Invalid
- **Confidence Score**: 0-100% confidence in the decision
- **Validation Type**: zoom_meeting, video_call, invalid, or unclear
- **Detected Elements**:
  - Has multiple people
  - People count
  - Has Zoom UI
  - Has FaceTime UI
  - Has WhatsApp UI
  - Has other video call UI
- **Reason**: Explanation of why it's valid or invalid
- **Issues**: List of specific problems if invalid

## How It Works

### 1. Screenshot Upload
When an agent uploads a screenshot:
1. File is uploaded via `/api/verification/session/:sessionId/screenshot` (for general) or `/api/zoom-verification/upload-screenshot` (for Zoom)
2. Screenshot is converted to base64
3. AI validation is triggered automatically

### 2. AI Validation
```typescript
const validationResult = await verificationScreenshotValidator.validateScreenshot(
  base64Screenshot,
  verificationMethod // 'zoom' or 'phone'
);
```

### 3. Decision Logic
- If `isValid === false` AND `confidence > 0.7`: **Screenshot is rejected**
- If `isValid === true` OR `confidence < 0.7`: Screenshot is accepted
- Validation results are stored in `screenshot_validation` field

### 4. Admin Review
Admins can see validation results in the AOI-precheck admin panel:
- ✅ **AI Verified** badge for valid screenshots
- ❌ **AI Rejected** badge for invalid screenshots
- Detailed analysis panel showing confidence, reason, and detected elements

## Technical Implementation

### Files Created/Modified

1. **`server/verification-screenshot-validator.ts`** (NEW)
   - Core AI validation logic
   - Uses OpenAI GPT-4o-mini Vision API
   - Validates screenshots based on verification method

2. **`server/routes.ts`** (MODIFIED)
   - Added AI validation to screenshot upload endpoints
   - Added `/api/test-verification-ai` test endpoint
   - Added `/api/zoom-verification/upload-screenshot` endpoint

3. **`client/src/pages/AOIPrecheckAdmin.tsx`** (MODIFIED)
   - Updated interface to include `screenshot_validation` field
   - Added AI validation status badges
   - Added detailed validation info panel

4. **`test-verification-ai.cjs`** (NEW)
   - Test script for validating the AI system
   - Can test individual images or run batch tests

## Usage

### For Agents (Upload)
When uploading a screenshot:
- If **VALID**: Screenshot uploads successfully
- If **INVALID**: Upload is rejected with clear error message explaining why

### For Admins (Review)
In the AOI-precheck admin panel:
1. Open any session with a screenshot
2. View the AI validation badge next to "Screenshot"
3. Expand the AI analysis panel to see details
4. Review confidence score and detected elements

## Testing

### Test Single Image
```bash
node test-verification-ai.cjs path/to/screenshot.png zoom
```

### Test Multiple Images
Create a `test-images` folder with test screenshots and run:
```bash
node test-verification-ai.cjs
```

### Test via API
```bash
curl -X POST http://localhost:5000/api/test-verification-ai \
  -H "Content-Type: application/json" \
  -d '{
    "screenshotData": "data:image/png;base64,...",
    "verificationMethod": "zoom"
  }'
```

## Configuration

### API Key
The system uses the OpenAI API key configured in the environment or hardcoded fallback:
```typescript
const openAIClient = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || '[FALLBACK_KEY]'
});
```

### Rejection Threshold
Screenshots are rejected if validation fails with >70% confidence:
```typescript
if (!validationResult.isValid && validationResult.confidence > 0.7) {
  // Reject the upload
}
```

## Benefits

### ✅ For Admins
- **Automatic quality control**: No need to manually review every screenshot
- **Detailed insights**: Understand exactly what the AI detected
- **Reduced workload**: Invalid submissions are rejected immediately

### ✅ For Agents
- **Clear feedback**: Know immediately if screenshot doesn't meet requirements
- **Better compliance**: Can't submit random photos or invalid screenshots
- **Faster process**: No back-and-forth about invalid submissions

### ✅ For the Organization
- **Data quality**: Only valid verification screenshots in the system
- **Compliance**: Ensures proper verification documentation
- **Audit trail**: Full AI analysis stored for each screenshot

## Future Enhancements

Possible improvements:
- [ ] Add manual override for admins
- [ ] Implement appeal process for agents
- [ ] Add screenshot quality checks (resolution, clarity)
- [ ] Detect specific video conferencing apps
- [ ] Validate timestamp visibility
- [ ] Check for photo manipulation/editing

## Support

If you encounter issues:
1. Check server logs for AI validation errors
2. Verify OpenAI API key is valid
3. Test with the `test-verification-ai.cjs` script
4. Contact system administrator

## API Reference

### POST `/api/verification/session/:sessionId/screenshot`
Upload and validate screenshot for verification session

**Request:**
- `multipart/form-data` with `screenshot` file

**Response:**
```json
{
  "message": "Screenshot uploaded successfully",
  "screenshotUrl": "https://...",
  "validation": {
    "isValid": true,
    "confidence": 0.95,
    "reason": "Valid Zoom meeting screenshot..."
  }
}
```

### POST `/api/test-verification-ai`
Test AI validation without uploading

**Request:**
```json
{
  "screenshotData": "data:image/png;base64,...",
  "verificationMethod": "zoom"
}
```

**Response:**
```json
{
  "isValid": true,
  "confidence": 0.95,
  "validationType": "zoom_meeting",
  "reason": "Screenshot shows valid Zoom meeting...",
  "detectedElements": {
    "hasMultiplePeople": true,
    "peopleCount": 2,
    "hasZoomUI": true,
    "hasVideoCallInterface": true
  },
  "issues": []
}
```

