-- REMOVE ALL LIVE CALL BOARD UPDATE CODE
-- This drops all triggers and functions that update live_call_board
-- The table remains but will not be auto-updated anymore

-- Drop all triggers
DROP TRIGGER IF EXISTS trigger_update_live_call_board_status ON agent_live_call_status;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_customers ON customers;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_hierarchy ON agent_hierarchy;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_leads ON masterlead;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_call ON call_connector_tracker;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_stats ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_presentation ON presentation_sessions;

-- Drop all functions
DROP FUNCTION IF EXISTS update_live_call_board_from_status();
DROP FUNCTION IF EXISTS update_live_call_board_from_customers();
DROP FUNCTION IF EXISTS update_live_call_board_from_hierarchy();
DROP FUNCTION IF EXISTS update_live_call_board_pending_leads();
DROP FUNCTION IF EXISTS update_live_call_board_current_call();
DROP FUNCTION IF EXISTS update_live_call_board_stats_on_metric();
DROP FUNCTION IF EXISTS update_live_call_board_presentation();
DROP FUNCTION IF EXISTS refresh_live_call_board_comprehensive();
DROP FUNCTION IF EXISTS update_live_call_board_stats_today();

-- Confirm removal
SELECT 'All live_call_board update triggers and functions have been removed' AS status;

