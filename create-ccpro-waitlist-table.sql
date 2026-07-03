-- Create Call Connector Pro Waitlist Table
CREATE TABLE IF NOT EXISTS ccpro_waitlist (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ccpro_waitlist_email ON ccpro_waitlist(user_email);
CREATE INDEX IF NOT EXISTS idx_ccpro_waitlist_created_at ON ccpro_waitlist(created_at);

-- Add RLS policies
ALTER TABLE ccpro_waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own waitlist entry
CREATE POLICY "Users can view own waitlist entry"
  ON ccpro_waitlist
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Policy: Users can insert their own waitlist entry
CREATE POLICY "Users can insert own waitlist entry"
  ON ccpro_waitlist
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- Policy: Service role can do everything (for API endpoints)
CREATE POLICY "Service role full access"
  ON ccpro_waitlist
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to calculate position (for display)
-- Position is calculated as: count of users who joined before this user + 1
CREATE OR REPLACE FUNCTION get_waitlist_position(p_user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_position INTEGER;
  v_user_created_at TIMESTAMPTZ;
BEGIN
  -- Get the user's created_at timestamp
  SELECT created_at INTO v_user_created_at
  FROM ccpro_waitlist
  WHERE user_email = p_user_email;
  
  -- If user not found, return NULL
  IF v_user_created_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Count users who joined before this user
  SELECT COUNT(*) + 1 INTO v_position
  FROM ccpro_waitlist
  WHERE created_at < v_user_created_at;
  
  RETURN v_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
