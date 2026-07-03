-- QUICK FIX: Create live_call_boardt table so trigger doesn't fail
-- This allows agent_dial_metrics inserts to work immediately
-- Run this FIRST, then run fix-trigger-missing-table.sql

CREATE TABLE IF NOT EXISTS live_call_boardt (
  agent_email        text PRIMARY KEY,
  agent_name         text,
  status             text DEFAULT 'offline',
  today_dialed       integer DEFAULT 0,
  today_reached      integer DEFAULT 0,
  today_booked       integer DEFAULT 0,
  today_presentations integer DEFAULT 0,
  today_sales        integer DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_call_boardt_agent_email 
  ON live_call_boardt (agent_email);

CREATE INDEX IF NOT EXISTS idx_live_call_boardt_updated_at 
  ON live_call_boardt (updated_at DESC);

COMMENT ON TABLE live_call_boardt IS 'Stats aggregation table for leaderboard. Updated by triggers from agent_dial_metrics.';
