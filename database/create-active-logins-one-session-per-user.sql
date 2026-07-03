-- One session per login: only the most recent login is valid. Older sessions are invalidated.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS active_logins (
  user_email TEXT PRIMARY KEY,
  valid_jwt_iat BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE active_logins IS 'Stores the JWT iat (issued-at) of the current valid login per user. Newer logins overwrite; requests with older JWTs are rejected.';
