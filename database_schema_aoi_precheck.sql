-- AOI Precheck Sessions - Complete Database Schema
-- This table stores all verification session data for the AOI Precheck Admin system

CREATE TABLE aoi_precheck_sessions (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Client Information
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    policy_number VARCHAR(100),
    premium_amount DECIMAL(10,2),
    
    -- Agent Information  
    agent_email VARCHAR(255) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    
    -- Verification Details
    verification_method VARCHAR(50) NOT NULL CHECK (verification_method IN ('zoom', 'phone', 'upload')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    
    -- Session Data & Evidence
    session_data JSONB DEFAULT '{}', -- Contains: ip_address, transcript, screenshots, user_agent, screen_resolution
    verification_score INTEGER CHECK (verification_score >= 0 AND verification_score <= 100),
    verification_notes TEXT,
    
    -- Evidence URLs - Easy access to key verification files
    certificate_url TEXT,         -- Direct URL to verification certificate
    screenshot_url TEXT,           -- Direct URL to verification screenshot/picture  
    recording_url TEXT,            -- Direct URL to call recording
    transcript_url TEXT,           -- Direct URL to transcript file
    
    -- Call/Session Timing
    call_duration INTEGER DEFAULT 0, -- Duration in seconds
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit Trail
    updated_by VARCHAR(255), -- Who made the last update
    status_history JSONB DEFAULT '[]', -- Array of status changes with timestamps
    
    -- Note: Foreign key constraint removed due to email field not being unique in agent_profiles
    -- Relationship handled via API endpoint /api/aoi-precheck/agent-teams
);

-- Indexes for optimal query performance
CREATE INDEX idx_aoi_precheck_sessions_agent_email ON aoi_precheck_sessions(agent_email);
CREATE INDEX idx_aoi_precheck_sessions_status ON aoi_precheck_sessions(status);
CREATE INDEX idx_aoi_precheck_sessions_method ON aoi_precheck_sessions(verification_method);
CREATE INDEX idx_aoi_precheck_sessions_created_at ON aoi_precheck_sessions(created_at DESC);
CREATE INDEX idx_aoi_precheck_sessions_client_email ON aoi_precheck_sessions(client_email);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_aoi_precheck_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_aoi_precheck_sessions_updated_at
    BEFORE UPDATE ON aoi_precheck_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_aoi_precheck_sessions_updated_at();

-- Complete query to get all data including team information
-- This is the query your API should use to fetch sessions with team data
SELECT 
    s.id,
    s.client_name,
    s.client_email,
    s.client_phone,
    s.policy_number,
    s.premium_amount,
    s.agent_email,
    s.agent_name,
    s.verification_method,
    s.status,
    s.session_data,
    s.verification_score,
    s.verification_notes,
    s.call_duration,
    s.call_recording_url,
    s.created_at,
    s.updated_at,
    s.completed_at,
    s.updated_by,
    s.status_history,
    -- Team data from agent profiles
    ap.mga_team,
    ap.rga_team,
    ap.team_role
FROM aoi_precheck_sessions s
LEFT JOIN agent_profiles ap ON s.agent_email = ap.email
ORDER BY s.created_at DESC;

-- Sample data structure for session_data JSONB field:
/*
{
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "screen_resolution": "1920x1080",
  "transcript": "Agent: Hello Mr. Smith, I am calling to verify your policy...",
  "screenshots": [
    {
      "timestamp": "2025-09-13T10:30:00Z",
      "url": "https://storage.url/screenshot1.jpg",
      "type": "id_verification"
    }
  ],
  "verification_steps": [
    {
      "step": "identity_check",
      "status": "completed",
      "timestamp": "2025-09-13T10:31:00Z"
    }
  ],
  "browser_info": {
    "platform": "MacIntel",
    "language": "en-US"
  }
}
*/

-- Sample status_history JSONB structure:
/*
[
  {
    "status": "pending",
    "timestamp": "2025-09-13T10:30:00Z",
    "updated_by": "system"
  },
  {
    "status": "in_progress", 
    "timestamp": "2025-09-13T10:31:00Z",
    "updated_by": "agent",
    "note": "Client answered verification call"
  },
  {
    "status": "completed",
    "timestamp": "2025-09-13T10:45:00Z", 
    "updated_by": "manager",
    "note": "Verification successful, all documents verified"
  }
]
*/

-- Query for dashboard stats
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today
FROM aoi_precheck_sessions;

-- Query for unique agents (for filter dropdown)
SELECT DISTINCT agent_email 
FROM aoi_precheck_sessions 
WHERE agent_email IS NOT NULL 
ORDER BY agent_email;

-- Advanced query with filters (example of what your API endpoint should support)
SELECT 
    s.*,
    ap.mga_team,
    ap.rga_team,
    ap.team_role
FROM aoi_precheck_sessions s
LEFT JOIN agent_profiles ap ON s.agent_email = ap.email
WHERE 
    ($1::text IS NULL OR s.client_name ILIKE '%' || $1 || '%' 
     OR s.client_email ILIKE '%' || $1 || '%' 
     OR s.agent_email ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR $2 = 'all' OR s.status = $2)
    AND ($3::text IS NULL OR $3 = 'all' OR s.verification_method = $3)
    AND ($4::text IS NULL OR $4 = 'all' OR s.agent_email = $4)
    AND (
        $5::text IS NULL OR $5 = 'all' OR 
        ($5 = 'today' AND DATE(s.created_at) = CURRENT_DATE) OR
        ($5 = 'week' AND s.created_at >= CURRENT_DATE - INTERVAL '7 days') OR
        ($5 = 'month' AND s.created_at >= CURRENT_DATE - INTERVAL '30 days')
    )
ORDER BY s.created_at DESC
LIMIT 1000;