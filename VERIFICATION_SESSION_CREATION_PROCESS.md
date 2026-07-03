# Verification Session Creation Process - Backend

## Overview
This document explains the complete backend process for creating a verification session, including all data points required and the flow of operations.

## API Endpoint
**POST** `/api/verification/session`

## Authentication Methods
The endpoint supports two authentication methods (in priority order):

1. **Supabase JWT Token** (Bearer token in Authorization header)
   - Extracts token from `Authorization: Bearer <token>`
   - Validates token with Supabase Auth
   - Extracts user email from token

2. **Session-based Authentication** (fallback)
   - Checks `req.session.user.email`
   - Falls back to `req.session.passport.user` or `req.session`
   - Checks headers: `x-user-email` or `user-email`

**⚠️ CRITICAL:** Session creation fails with 401 if no authentication is found.

## Required Request Body Data Points

### Client Information (Required)
Based on `clientInfoSchema`:

```typescript
{
  firstName: string,           // Client's first name
  lastName: string,            // Client's last name
  phone: string,               // Client's phone number
  city: string,                // Client's city
  state: string,               // Client's state
  premium: string,             // Premium amount
  language: string,           // Default: 'en'
  verificationMethod: 'zoom' | 'phone' | 'whatsapp' | 'facetime',
  
  // Optional fields
  spouseName?: string,         // Spouse/beneficiary name
  agentPhone?: string,          // Agent's phone number
  agentFirstName?: string,     // Agent's first name (usually auto-filled)
  agentLastName?: string,       // Agent's last name (usually auto-filled)
  associateId?: number,        // Agent's associate ID (usually auto-filled)
  achDrawDate?: string,         // ACH draw date
  achDrawDateShort?: string,    // Short format ACH draw date
  zoomRoomId?: string,          // Zoom room ID (for Zoom verification)
  zoomPassword?: string         // Zoom password (for Zoom verification)
}
```

### Agent Geolocation (Optional but Flagged)
The system attempts to collect agent geolocation:
- `agentLatitude`
- `agentLongitude`
- `agentAccuracy`
- `agentPublicIp`
- `agentTimezone`
- `agentGeolocationDenied` (flag if denied)
- `agentGeolocationError` (error message if failed)

**Note:** If geolocation is denied or missing, the session is still created but flagged for IP analysis.

## Backend Process Flow

### Step 1: Authentication & Agent Lookup
1. **Authenticate user** (JWT or session)
2. **Get agent email** from authentication
3. **Lookup agent profile** from `agent_profiles` table:
   ```sql
   SELECT id, email, first_name, last_name, phone, mga_team, rga_team, zoom_id, zoom_password
   FROM agent_profiles
   WHERE email = {normalizedEmail}
   ```
4. **Get associate_id** from `producerlist` table:
   ```sql
   SELECT associate_id, company_email, first_name, last_name, mga
   FROM producerlist
   WHERE company_email = {normalizedEmail}
   ```

### Step 2: MGA/RGA Team Resolution
The system resolves MGA/RGA teams with this priority:

1. **agent_profiles.mga_team / rga_team** (highest priority - what agent entered)
2. **agent_hierarchy.mga_name / rga_name** (from hierarchy lookup)
3. **producerlist.mga** (fallback)

**Lookup Process:**
- First tries `agent_hierarchy` by `associate_id`
- Then tries `agent_hierarchy` by `agent_email`
- Finally tries `agent_hierarchy` by agent name (first + last)

### Step 3: Session ID Generation
```typescript
sessionId = `VER-${Date.now()}-${nanoid(6)}`
```
Example: `VER-1703123456789-AbC123`

### Step 4: Database Record Creation

The system creates a record in `verification_sessions` table with:

**Required Fields:**
- `session_id`: Generated unique ID
- `first_name`: Client's first name
- `last_name`: Client's last name
- `phone`: Client's phone number
- `city`: Client's city
- `state`: Client's state
- `premium`: Premium amount
- `verification_method`: 'zoom' | 'phone' | 'whatsapp' | 'facetime'
- `language`: Default 'en'
- `status`: 'pending' (initial status)
- `created_at`: Current timestamp

**Agent Information:**
- `agent_first_name`: From agent_profiles or request body
- `agent_last_name`: From agent_profiles or request body
- `agent_phone`: From request body or agent_profiles
- `company_email`: Agent's email (from authentication)
- `associate_id`: From producerlist lookup
- `agent_mga_team`: Resolved MGA team
- `agent_rga_team`: Resolved RGA team

**Optional Fields:**
- `spouse_name`: Beneficiary/spouse name
- `ach_draw_date`: ACH draw date
- `ach_draw_date_short`: Short format ACH date
- `zoom_room_id`: Zoom room ID (for Zoom method)
- `zoom_password`: Zoom password (for Zoom method)

**Critical Flags:**
- `screenshot_url`: Set to `'PENDING'` - tells scheduler to analyze this session
- `recording_url`: Set to `'PENDING'` - tells scheduler to analyze this session

### Step 5: Response
Returns the created `VerificationSession` object with:
- All session fields (converted from snake_case to camelCase)
- Generated `sessionId`
- Status: `'pending'`
- Timestamps: `createdAt`

## Data Lookup Tables

### 1. `agent_profiles`
**Purpose:** Primary agent data source
**Fields Used:**
- `email` (for lookup)
- `first_name`, `last_name` (agent name)
- `phone` (agent phone)
- `mga_team`, `rga_team` (team assignments - highest priority)
- `zoom_id`, `zoom_password` (Zoom credentials)

### 2. `producerlist`
**Purpose:** Get associate_id and fallback MGA
**Fields Used:**
- `company_email` (for lookup)
- `associate_id` (agent ID)
- `mga` (fallback MGA team)

### 3. `agent_hierarchy`
**Purpose:** Get MGA/RGA teams if not in agent_profiles
**Lookup Methods:**
1. By `agent_associate_id`
2. By `agent_email`
3. By `agent_name` (first + last name)

**Fields Used:**
- `mga_name` (MGA team)
- `rga_name` (RGA team)
- `agent_associate_id` (for matching)

## Error Handling

### Authentication Errors
- **401 Unauthorized:** No user email found in JWT, session, or headers
- Message: "Authentication required - You must be logged in to create a verification session"

### Agent Not Found
- **422 Unprocessable Entity:** Agent email not found in `agent_profiles` table
- Code: `AGENT_NOT_FOUND`
- Message: "No agent profile found for {email}. Please ensure your email is registered in the system."
- Includes suggestions for resolution

### Database Errors
- **500 Internal Server Error:** Database query failures
- Message: "Database error - Unable to verify agent credentials. Please try again."

## Post-Creation Processing

After session creation, the system:

1. **Screenshot Analysis Scheduler** detects `screenshot_url = 'PENDING'` and processes screenshots
2. **Recording Analysis Scheduler** detects `recording_url = 'PENDING'` and processes recordings
3. **Verification Analysis** runs on completed sessions

## Summary

**Required Data Points:**
- Client: firstName, lastName, phone, city, state, premium, verificationMethod
- Agent: Email (from auth), profile data (auto-looked up)
- Optional: spouseName, agentPhone, zoomRoomId, zoomPassword, achDrawDate

**Auto-Resolved Data:**
- Agent name (from agent_profiles)
- Associate ID (from producerlist)
- MGA/RGA teams (priority: agent_profiles > agent_hierarchy > producerlist)
- Session ID (auto-generated)
- Status (set to 'pending')
- Timestamps (auto-generated)

**Critical Flags:**
- `screenshot_url = 'PENDING'` triggers screenshot analysis
- `recording_url = 'PENDING'` triggers recording analysis

