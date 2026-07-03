-- =====================================================
-- QUALITY MANAGER ASSIGNMENT SYSTEM
-- =====================================================
-- This extends the roles management system to support
-- Quality Manager assignments to MGA teams

-- =====================================================
-- 1. MGA TEAMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mga_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. QUALITY MANAGER ASSIGNMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS quality_manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qm_email VARCHAR(255) NOT NULL,
  mga_team_id UUID NOT NULL REFERENCES mga_teams(id) ON DELETE CASCADE,
  assigned_by VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  is_active BOOLEAN DEFAULT true,
  UNIQUE(qm_email, mga_team_id)
);

-- =====================================================
-- 3. AGENT MGA ASSIGNMENTS (from producerlist)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_mga_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email VARCHAR(255) NOT NULL,
  mga_team_name VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(agent_email, mga_team_name)
);

-- =====================================================
-- 4. QUALITY MANAGER PERMISSIONS VIEW
-- =====================================================
CREATE OR REPLACE VIEW quality_manager_permissions AS
SELECT 
  qma.qm_email,
  qma.mga_team_id,
  mt.name as mga_team_name,
  mt.display_name as mga_team_display_name,
  qma.assigned_at,
  qma.expires_at,
  qma.is_active as assignment_active,
  -- Get all agents in this MGA team
  COALESCE(
    json_agg(
      json_build_object(
        'agent_email', ama.agent_email,
        'assigned_at', ama.assigned_at
      )
    ) FILTER (WHERE ama.agent_email IS NOT NULL),
    '[]'::json
  ) as assigned_agents
FROM quality_manager_assignments qma
JOIN mga_teams mt ON qma.mga_team_id = mt.id
LEFT JOIN agent_mga_assignments ama ON mt.name = ama.mga_team_name AND ama.is_active = true
WHERE qma.is_active = true AND mt.is_active = true
GROUP BY qma.qm_email, qma.mga_team_id, mt.name, mt.display_name, qma.assigned_at, qma.expires_at, qma.is_active;

-- =====================================================
-- 5. QUALITY MANAGER DATA ACCESS VIEW
-- =====================================================
CREATE OR REPLACE VIEW quality_manager_data_access AS
SELECT 
  qma.qm_email,
  qma.mga_team_id,
  mt.name as mga_team_name,
  -- All agent emails this QM can access
  ARRAY_AGG(DISTINCT ama.agent_email) FILTER (WHERE ama.agent_email IS NOT NULL) as accessible_agents,
  -- Count of agents
  COUNT(DISTINCT ama.agent_email) as agent_count
FROM quality_manager_assignments qma
JOIN mga_teams mt ON qma.mga_team_id = mt.id
LEFT JOIN agent_mga_assignments ama ON mt.name = ama.mga_team_name AND ama.is_active = true
WHERE qma.is_active = true AND mt.is_active = true
GROUP BY qma.qm_email, qma.mga_team_id, mt.name;

-- =====================================================
-- 6. FUNCTIONS FOR QUALITY MANAGER OPERATIONS
-- =====================================================

-- Function to get Quality Manager's assigned MGA teams
CREATE OR REPLACE FUNCTION get_qm_mga_teams(qm_email_param VARCHAR(255))
RETURNS TABLE (
  mga_team_id UUID,
  mga_team_name VARCHAR(100),
  mga_team_display_name VARCHAR(150),
  assigned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  agent_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qma.mga_team_id,
    mt.name as mga_team_name,
    mt.display_name as mga_team_display_name,
    qma.assigned_at,
    qma.expires_at,
    COUNT(ama.agent_email) as agent_count
  FROM quality_manager_assignments qma
  JOIN mga_teams mt ON qma.mga_team_id = mt.id
  LEFT JOIN agent_mga_assignments ama ON mt.name = ama.mga_team_name AND ama.is_active = true
  WHERE qma.qm_email = qm_email_param 
    AND qma.is_active = true 
    AND mt.is_active = true
    AND (qma.expires_at IS NULL OR qma.expires_at > NOW())
  GROUP BY qma.mga_team_id, mt.name, mt.display_name, qma.assigned_at, qma.expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all agents a Quality Manager can access
CREATE OR REPLACE FUNCTION get_qm_accessible_agents(qm_email_param VARCHAR(255))
RETURNS TABLE (
  agent_email VARCHAR(255),
  mga_team_name VARCHAR(100),
  assigned_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ama.agent_email,
    ama.mga_team_name,
    ama.assigned_at
  FROM quality_manager_assignments qma
  JOIN mga_teams mt ON qma.mga_team_id = mt.id
  JOIN agent_mga_assignments ama ON mt.name = ama.mga_team_name
  WHERE qma.qm_email = qm_email_param 
    AND qma.is_active = true 
    AND mt.is_active = true
    AND ama.is_active = true
    AND (qma.expires_at IS NULL OR qma.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if Quality Manager can access specific agent
CREATE OR REPLACE FUNCTION qm_can_access_agent(
  qm_email_param VARCHAR(255),
  agent_email_param VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
  can_access BOOLEAN := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM quality_manager_assignments qma
    JOIN mga_teams mt ON qma.mga_team_id = mt.id
    JOIN agent_mga_assignments ama ON mt.name = ama.mga_team_name
    WHERE qma.qm_email = qm_email_param 
      AND ama.agent_email = agent_email_param
      AND qma.is_active = true 
      AND mt.is_active = true
      AND ama.is_active = true
      AND (qma.expires_at IS NULL OR qma.expires_at > NOW())
  ) INTO can_access;
  
  RETURN can_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mga_teams_name ON mga_teams(name);
CREATE INDEX IF NOT EXISTS idx_mga_teams_active ON mga_teams(is_active);
CREATE INDEX IF NOT EXISTS idx_qm_assignments_email ON quality_manager_assignments(qm_email);
CREATE INDEX IF NOT EXISTS idx_qm_assignments_team ON quality_manager_assignments(mga_team_id);
CREATE INDEX IF NOT EXISTS idx_qm_assignments_active ON quality_manager_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_mga_email ON agent_mga_assignments(agent_email);
CREATE INDEX IF NOT EXISTS idx_agent_mga_team ON agent_mga_assignments(mga_team_name);
CREATE INDEX IF NOT EXISTS idx_agent_mga_active ON agent_mga_assignments(is_active);

-- =====================================================
-- 8. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE mga_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_mga_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. INSERT SAMPLE MGA TEAMS (from producerlist data)
-- =====================================================
-- This would typically be populated from your producerlist table
-- Example teams based on common MGA patterns
INSERT INTO mga_teams (name, display_name, description) VALUES
('Team Alpha', 'Team Alpha', 'Primary MGA team'),
('Team Beta', 'Team Beta', 'Secondary MGA team'),
('Team Gamma', 'Team Gamma', 'Regional MGA team'),
('Team Delta', 'Team Delta', 'Specialized MGA team'),
('Team Epsilon', 'Team Epsilon', 'New MGA team')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 10. MIGRATION FUNCTION TO POPULATE FROM PRODUCERLIST
-- =====================================================
CREATE OR REPLACE FUNCTION migrate_mga_teams_from_producerlist()
RETURNS TABLE (
  mga_team_name VARCHAR(100),
  agent_count BIGINT
) AS $$
BEGIN
  -- Insert unique MGA teams from producerlist
  INSERT INTO mga_teams (name, display_name, description)
  SELECT DISTINCT 
    mga as name,
    mga as display_name,
    'MGA team from producerlist' as description
  FROM producerlist 
  WHERE mga IS NOT NULL 
    AND mga != ''
    AND NOT EXISTS (SELECT 1 FROM mga_teams WHERE name = producerlist.mga)
  ON CONFLICT (name) DO NOTHING;

  -- Populate agent assignments
  INSERT INTO agent_mga_assignments (agent_email, mga_team_name)
  SELECT DISTINCT 
    company_email as agent_email,
    mga as mga_team_name
  FROM producerlist 
  WHERE company_email IS NOT NULL 
    AND mga IS NOT NULL 
    AND mga != ''
    AND NOT EXISTS (
      SELECT 1 FROM agent_mga_assignments 
      WHERE agent_email = producerlist.company_email 
        AND mga_team_name = producerlist.mga
    )
  ON CONFLICT (agent_email, mga_team_name) DO NOTHING;

  -- Return summary
  RETURN QUERY
  SELECT 
    mt.name as mga_team_name,
    COUNT(ama.agent_email) as agent_count
  FROM mga_teams mt
  LEFT JOIN agent_mga_assignments ama ON mt.name = ama.mga_team_name AND ama.is_active = true
  WHERE mt.is_active = true
  GROUP BY mt.name
  ORDER BY agent_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. AUDIT LOGGING FOR QUALITY MANAGER ASSIGNMENTS
-- =====================================================
CREATE OR REPLACE FUNCTION log_qm_assignment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO role_audit_logs (admin_email, action, target_user_email, details)
    VALUES (
      NEW.assigned_by,
      'assign_quality_manager',
      NEW.qm_email,
      jsonb_build_object(
        'mga_team_id', NEW.mga_team_id,
        'assigned_at', NEW.assigned_at,
        'expires_at', NEW.expires_at
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active != NEW.is_active THEN
      INSERT INTO role_audit_logs (admin_email, action, target_user_email, details)
      VALUES (
        COALESCE(NEW.assigned_by, 'system'),
        CASE WHEN NEW.is_active THEN 'activate_qm_assignment' ELSE 'deactivate_qm_assignment' END,
        NEW.qm_email,
        jsonb_build_object(
          'mga_team_id', NEW.mga_team_id,
          'previous_status', OLD.is_active,
          'new_status', NEW.is_active
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO role_audit_logs (admin_email, action, target_user_email, details)
    VALUES (
      COALESCE(OLD.assigned_by, 'system'),
      'revoke_quality_manager',
      OLD.qm_email,
      jsonb_build_object(
        'mga_team_id', OLD.mga_team_id,
        'revoked_at', NOW()
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quality manager assignments
CREATE TRIGGER qm_assignments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON quality_manager_assignments
  FOR EACH ROW EXECUTE FUNCTION log_qm_assignment_changes();

-- =====================================================
-- 12. GRANT PERMISSIONS
-- =====================================================
GRANT SELECT ON mga_teams TO authenticated;
GRANT SELECT ON quality_manager_assignments TO authenticated;
GRANT SELECT ON agent_mga_assignments TO authenticated;
GRANT SELECT ON quality_manager_permissions TO authenticated;
GRANT SELECT ON quality_manager_data_access TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_qm_mga_teams(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_qm_accessible_agents(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION qm_can_access_agent(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_mga_teams_from_producerlist() TO authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Quality Manager Assignment System created successfully!';
  RAISE NOTICE 'Tables created: mga_teams, quality_manager_assignments, agent_mga_assignments';
  RAISE NOTICE 'Views created: quality_manager_permissions, quality_manager_data_access';
  RAISE NOTICE 'Functions created: get_qm_mga_teams(), get_qm_accessible_agents(), qm_can_access_agent()';
  RAISE NOTICE 'Migration function: migrate_mga_teams_from_producerlist()';
  RAISE NOTICE 'Audit logging enabled for Quality Manager assignments';
  RAISE NOTICE 'Run migrate_mga_teams_from_producerlist() to populate from existing producerlist data';
END $$;

