-- Add VPN detection columns to verification_sessions table
-- These columns store VPN/proxy/hosting detection results for easier querying

ALTER TABLE verification_sessions
ADD COLUMN IF NOT EXISTS client_is_vpn BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_is_proxy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_is_hosting BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_vpn_detection_reason TEXT,
ADD COLUMN IF NOT EXISTS agent_is_vpn BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_is_proxy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_is_hosting BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_vpn_detection_reason TEXT;

-- Create indexes for faster VPN queries
CREATE INDEX IF NOT EXISTS idx_verification_sessions_client_vpn 
  ON verification_sessions(client_is_vpn) 
  WHERE client_is_vpn = TRUE;

CREATE INDEX IF NOT EXISTS idx_verification_sessions_agent_vpn 
  ON verification_sessions(agent_is_vpn) 
  WHERE agent_is_vpn = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN verification_sessions.client_is_vpn IS 'True if client IP is detected as VPN/proxy/hosting';
COMMENT ON COLUMN verification_sessions.client_is_proxy IS 'True if client IP is flagged as proxy by ip-api.com';
COMMENT ON COLUMN verification_sessions.client_is_hosting IS 'True if client IP is flagged as hosting/datacenter by ip-api.com';
COMMENT ON COLUMN verification_sessions.client_vpn_detection_reason IS 'Reason for VPN detection (e.g., ISP name contains VPN keyword, or proxy/hosting flag from API)';
COMMENT ON COLUMN verification_sessions.agent_is_vpn IS 'True if agent IP is detected as VPN/proxy/hosting';
COMMENT ON COLUMN verification_sessions.agent_is_proxy IS 'True if agent IP is flagged as proxy by ip-api.com';
COMMENT ON COLUMN verification_sessions.agent_is_hosting IS 'True if agent IP is flagged as hosting/datacenter by ip-api.com';
COMMENT ON COLUMN verification_sessions.agent_vpn_detection_reason IS 'Reason for VPN detection (e.g., ISP name contains VPN keyword, or proxy/hosting flag from API)';

