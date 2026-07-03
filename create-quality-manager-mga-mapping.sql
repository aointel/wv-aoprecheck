-- =====================================================
-- QUALITY MANAGER MGA MAPPING SYSTEM
-- =====================================================
-- This creates a proper mapping between MGA teams from producerlist
-- and Quality Managers, replacing the current broken system

-- 1. Create MGA teams table with data from producerlist
CREATE TABLE IF NOT EXISTS mga_teams_from_producerlist (
  id SERIAL PRIMARY KEY,
  mga_name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create Quality Manager assignments table
CREATE TABLE IF NOT EXISTS qm_mga_assignments (
  id SERIAL PRIMARY KEY,
  qm_email VARCHAR(255) NOT NULL,
  mga_name VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(qm_email, mga_name)
);

-- 3. Insert MGA teams from producerlist (distinct values)
INSERT INTO mga_teams_from_producerlist (mga_name)
SELECT DISTINCT mga_team 
FROM producerlist 
WHERE mga_team IS NOT NULL 
  AND mga_team != ''
  AND mga_team != 'null'
ON CONFLICT (mga_name) DO NOTHING;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qm_mga_assignments_qm_email ON qm_mga_assignments(qm_email);
CREATE INDEX IF NOT EXISTS idx_qm_mga_assignments_mga_name ON qm_mga_assignments(mga_name);
CREATE INDEX IF NOT EXISTS idx_qm_mga_assignments_active ON qm_mga_assignments(is_active);

-- 5. Create function to get QM assigned teams
CREATE OR REPLACE FUNCTION get_qm_assigned_teams(qm_email_param VARCHAR)
RETURNS TABLE(mga_name VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT qma.mga_name
  FROM qm_mga_assignments qma
  WHERE qma.qm_email = qm_email_param
    AND qma.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to assign QM to MGA team
CREATE OR REPLACE FUNCTION assign_qm_to_mga(
  qm_email_param VARCHAR,
  mga_name_param VARCHAR,
  assigned_by_param VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO qm_mga_assignments (qm_email, mga_name, assigned_by)
  VALUES (qm_email_param, mga_name_param, assigned_by_param)
  ON CONFLICT (qm_email, mga_name) 
  DO UPDATE SET 
    is_active = true,
    assigned_at = NOW(),
    assigned_by = assigned_by_param;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to remove QM from MGA team
CREATE OR REPLACE FUNCTION remove_qm_from_mga(
  qm_email_param VARCHAR,
  mga_name_param VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE qm_mga_assignments 
  SET is_active = false
  WHERE qm_email = qm_email_param 
    AND mga_name = mga_name_param;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 8. Create view for easy querying
CREATE OR REPLACE VIEW qm_team_assignments_view AS
SELECT 
  qma.qm_email,
  qma.mga_name,
  qma.assigned_at,
  qma.assigned_by,
  qma.is_active,
  mt.id as mga_team_id
FROM qm_mga_assignments qma
JOIN mga_teams_from_producerlist mt ON qma.mga_name = mt.mga_name
WHERE qma.is_active = true;

-- 9. Insert some sample assignments (replace with actual QM assignments)
-- Example: Assign tomanovichqm to specific teams only
INSERT INTO qm_mga_assignments (qm_email, mga_name, assigned_by)
VALUES 
  ('tomanovichqm@aoglobelife.com', 'JOSEPH TOMANOVICH', 'system'),
  ('tomanovichqm@aoglobelife.com', 'MARIA LAGIOS', 'system'),
  ('tomanovichqm@aoglobelife.com', 'COLLIN DICKINSON', 'system')
ON CONFLICT (qm_email, mga_name) DO NOTHING;

-- 10. Create RLS policies for security
ALTER TABLE qm_mga_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mga_teams_from_producerlist ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own assignments
CREATE POLICY "Users can read their own QM assignments" ON qm_mga_assignments
  FOR SELECT USING (auth.jwt() ->> 'email' = qm_email);

-- Allow system to manage assignments (adjust as needed for your auth system)
CREATE POLICY "System can manage QM assignments" ON qm_mga_assignments
  FOR ALL USING (true);

CREATE POLICY "Anyone can read MGA teams" ON mga_teams_from_producerlist
  FOR SELECT USING (true);

-- 11. Grant permissions
GRANT SELECT ON mga_teams_from_producerlist TO authenticated;
GRANT SELECT ON qm_mga_assignments TO authenticated;
GRANT SELECT ON qm_team_assignments_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_qm_assigned_teams(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_qm_to_mga(VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_qm_from_mga(VARCHAR, VARCHAR) TO authenticated;

-- 12. Show the results
SELECT 'MGA Teams from producerlist:' as info;
SELECT COUNT(*) as total_mga_teams FROM mga_teams_from_producerlist;

SELECT 'Current QM Assignments:' as info;
SELECT qm_email, COUNT(*) as assigned_teams 
FROM qm_mga_assignments 
WHERE is_active = true 
GROUP BY qm_email;

SELECT 'Sample MGA teams:' as info;
SELECT mga_name FROM mga_teams_from_producerlist LIMIT 10;

