-- =====================================================
-- AOI5 SUPABASE ROLES MANAGEMENT SYSTEM
-- =====================================================
-- This creates a comprehensive roles and permissions system
-- for managing user access across the AOI5 application

-- =====================================================
-- 1. ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER DEFAULT 0, -- 0=agent, 1=manager, 2=admin, 3=super_admin
  is_active BOOLEAN DEFAULT true,
  is_system_role BOOLEAN DEFAULT false, -- Cannot be deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'page', 'feature', 'data', 'admin'
  resource VARCHAR(100), -- Specific resource (e.g., 'leads', 'calls', 'reports')
  action VARCHAR(50), -- 'read', 'write', 'delete', 'manage'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. ROLE PERMISSIONS (Many-to-Many)
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by UUID, -- Admin who granted this permission
  UNIQUE(role_id, permission_id)
);

-- =====================================================
-- 4. USER ROLES (Many-to-Many)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by VARCHAR(255), -- Admin email who assigned this role
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_email, role_id)
);

-- =====================================================
-- 5. TEAM ASSIGNMENTS (For team-based permissions)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  team_type VARCHAR(20) NOT NULL, -- 'mga', 'rga', 'quality'
  team_name VARCHAR(100) NOT NULL,
  assigned_by VARCHAR(255),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_email, team_type, team_name)
);

-- =====================================================
-- 6. PERMISSION OVERRIDES (For specific user exceptions)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL, -- true = grant, false = deny
  reason TEXT,
  granted_by VARCHAR(255),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_email, permission_id)
);

-- =====================================================
-- 7. AUDIT LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS role_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'assign_role', 'revoke_role', 'grant_permission', etc.
  target_user_email VARCHAR(255),
  role_id UUID REFERENCES roles(id),
  permission_id UUID REFERENCES permissions(id),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(user_email);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_team_assignments_email ON user_team_assignments(user_email);
CREATE INDEX IF NOT EXISTS idx_user_team_assignments_team ON user_team_assignments(team_type, team_name);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_email ON user_permission_overrides(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON role_audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON role_audit_logs(target_user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON role_audit_logs(created_at);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 10. FUNCTIONS FOR PERMISSION CHECKING
-- =====================================================

-- Function to get user's effective permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_email_param VARCHAR(255))
RETURNS TABLE (
  permission_name VARCHAR(100),
  permission_category VARCHAR(50),
  permission_resource VARCHAR(100),
  permission_action VARCHAR(50),
  granted_by_role BOOLEAN,
  granted_by_override BOOLEAN,
  role_name VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  WITH user_role_permissions AS (
    -- Permissions granted through roles
    SELECT 
      p.name as permission_name,
      p.category as permission_category,
      p.resource as permission_resource,
      p.action as permission_action,
      true as granted_by_role,
      false as granted_by_override,
      r.name as role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_email = user_email_param 
      AND ur.is_active = true 
      AND r.is_active = true
      AND p.is_active = true
  ),
  user_override_permissions AS (
    -- Permissions granted/denied by overrides
    SELECT 
      p.name as permission_name,
      p.category as permission_category,
      p.resource as permission_resource,
      p.action as permission_action,
      false as granted_by_role,
      true as granted_by_override,
      'override' as role_name
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_email = user_email_param 
      AND upo.is_active = true 
      AND upo.granted = true
      AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
  )
  SELECT * FROM user_role_permissions
  UNION ALL
  SELECT * FROM user_override_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  user_email_param VARCHAR(255),
  permission_name_param VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  -- Check for explicit deny override first
  SELECT EXISTS(
    SELECT 1 FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_email = user_email_param 
      AND p.name = permission_name_param
      AND upo.granted = false
      AND upo.is_active = true
      AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN false; -- Explicitly denied
  END IF;
  
  -- Check for grant (either through role or override)
  SELECT EXISTS(
    SELECT 1 FROM get_user_permissions(user_email_param) 
    WHERE permission_name = permission_name_param
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. INSERT DEFAULT ROLES
-- =====================================================
INSERT INTO roles (name, display_name, description, level, is_system_role) VALUES
('super_admin', 'Super Administrator', 'Full system access including user management and system configuration', 3, true),
('admin', 'Administrator', 'Administrative access to manage users, teams, and system settings', 2, true),
('manager', 'Team Manager', 'Manage team members and view team performance reports', 1, true),
('quality_manager', 'Quality Manager', 'Quality assurance access to manage and review system processes', 1, true),
('ao_quality_manager', 'AO Quality Manager', 'AO-focused quality management with specialized access to AO Intelligence and reports', 1, true),
('agent', 'Agent', 'Basic access to make calls and manage own profile', 0, true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 12. INSERT DEFAULT PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, display_name, description, category, resource, action) VALUES
-- Page Access Permissions
('page.dashboard', 'Access Dashboard', 'View the main dashboard', 'page', 'dashboard', 'read'),
('page.ao_connect', 'Access AO Connect', 'View the AO Connect page', 'page', 'ao_connect', 'read'),
('page.ao_intelligence', 'Access AO Intelligence', 'View the AO Intelligence page', 'page', 'ao_intelligence', 'read'),
('page.appointments', 'Access Appointments', 'View the appointments page', 'page', 'appointments', 'read'),
('page.billing_dashboard', 'Access Billing Dashboard', 'View the billing dashboard', 'page', 'billing', 'read'),
('page.aoi_report', 'Access AOI Reports', 'View AOI reports', 'page', 'reports', 'read'),
('page.ao_precheck', 'Access AO Precheck', 'View AO Precheck page', 'page', 'precheck', 'read'),
('page.ao_precheck_management', 'Access AO Precheck Management', 'Manage AO Precheck processes', 'page', 'precheck', 'manage'),
('page.admin', 'Access Admin Panel', 'View the admin panel', 'page', 'admin', 'read'),
('page.settings', 'Access Settings', 'View system settings', 'page', 'settings', 'read'),

-- Feature Permissions
('feature.make_calls', 'Make Calls', 'Make outbound calls', 'feature', 'calls', 'write'),
('feature.receive_calls', 'Receive Calls', 'Receive inbound calls', 'feature', 'calls', 'read'),
('feature.view_leads', 'View Leads', 'View lead information', 'feature', 'leads', 'read'),
('feature.manage_leads', 'Manage Leads', 'Create, update, and delete leads', 'feature', 'leads', 'write'),
('feature.view_reports', 'View Reports', 'View various reports', 'feature', 'reports', 'read'),
('feature.export_data', 'Export Data', 'Export data from the system', 'feature', 'data', 'read'),

-- Data Permissions
('data.view_all_leads', 'View All Leads', 'View leads from all teams', 'data', 'leads', 'read'),
('data.view_team_leads', 'View Team Leads', 'View leads from assigned teams only', 'data', 'leads', 'read'),
('data.view_own_leads', 'View Own Leads', 'View only own leads', 'data', 'leads', 'read'),
('data.view_all_calls', 'View All Calls', 'View calls from all users', 'data', 'calls', 'read'),
('data.view_team_calls', 'View Team Calls', 'View calls from team members', 'data', 'calls', 'read'),
('data.view_own_calls', 'View Own Calls', 'View only own calls', 'data', 'calls', 'read'),
('data.view_pii', 'View PII', 'View personally identifiable information', 'data', 'pii', 'read'),
('data.view_evidence', 'View Evidence', 'View evidence files and recordings', 'data', 'evidence', 'read'),

-- Admin Permissions
('admin.manage_users', 'Manage Users', 'Create, update, and delete users', 'admin', 'users', 'manage'),
('admin.manage_roles', 'Manage Roles', 'Create, update, and delete roles', 'admin', 'roles', 'manage'),
('admin.manage_permissions', 'Manage Permissions', 'Create, update, and delete permissions', 'admin', 'permissions', 'manage'),
('admin.view_audit_logs', 'View Audit Logs', 'View system audit logs', 'admin', 'audit', 'read'),
('admin.system_settings', 'System Settings', 'Modify system settings', 'admin', 'settings', 'write'),
('admin.billing_management', 'Billing Management', 'Manage billing and credits', 'admin', 'billing', 'manage')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 13. ASSIGN DEFAULT ROLE PERMISSIONS
-- =====================================================

-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' 
  AND p.name IN (
    'page.dashboard', 'page.ao_connect', 'page.ao_intelligence', 'page.appointments', 
    'page.billing_dashboard', 'page.aoi_report', 'page.settings', 'page.admin',
    'feature.make_calls', 'feature.receive_calls', 'feature.view_leads', 'feature.manage_leads',
    'feature.view_reports', 'feature.export_data', 'data.view_all_leads', 'data.view_all_calls',
    'data.view_pii', 'data.view_evidence', 'admin.manage_users', 'admin.view_audit_logs',
    'admin.system_settings', 'admin.billing_management'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager' 
  AND p.name IN (
    'page.dashboard', 'page.ao_connect', 'page.appointments', 'page.aoi_report',
    'feature.make_calls', 'feature.receive_calls', 'feature.view_leads', 'feature.view_reports',
    'data.view_team_leads', 'data.view_team_calls', 'data.view_pii'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Quality Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'quality_manager' 
  AND p.name IN (
    'page.dashboard', 'page.ao_precheck', 'page.ao_precheck_management', 'page.aoi_report', 'page.settings',
    'feature.view_leads', 'feature.view_reports', 'data.view_all_leads', 'data.view_all_calls',
    'data.view_pii', 'data.view_evidence'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- AO Quality Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ao_quality_manager' 
  AND p.name IN (
    'page.dashboard', 'page.ao_intelligence', 'page.ao_precheck', 'page.ao_precheck_management', 
    'page.aoi_report', 'page.settings', 'feature.view_leads', 'feature.view_reports',
    'data.view_all_leads', 'data.view_all_calls', 'data.view_pii', 'data.view_evidence'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Agent permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'agent' 
  AND p.name IN (
    'page.dashboard', 'page.ao_connect', 'page.ao_intelligence', 'page.appointments',
    'feature.make_calls', 'feature.receive_calls', 'feature.view_leads', 'data.view_own_leads',
    'data.view_own_calls'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- 14. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

-- View for user permissions with role information
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
  ur.user_email,
  r.name as role_name,
  r.display_name as role_display_name,
  r.level as role_level,
  p.name as permission_name,
  p.display_name as permission_display_name,
  p.category as permission_category,
  p.resource as permission_resource,
  p.action as permission_action,
  ur.assigned_at,
  ur.expires_at,
  ur.is_active as role_active
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE ur.is_active = true AND r.is_active = true AND p.is_active = true;

-- View for team assignments
CREATE OR REPLACE VIEW user_team_assignments_view AS
SELECT 
  uta.user_email,
  uta.team_type,
  uta.team_name,
  uta.assigned_at,
  uta.is_active
FROM user_team_assignments uta
WHERE uta.is_active = true;

-- =====================================================
-- 15. TRIGGERS FOR AUDIT LOGGING
-- =====================================================

-- Function to log role changes
CREATE OR REPLACE FUNCTION log_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO role_audit_logs (admin_email, action, target_user_email, role_id, details)
    VALUES (
      COALESCE(NEW.assigned_by, 'system'),
      'assign_role',
      NEW.user_email,
      NEW.role_id,
      jsonb_build_object('role_assigned', NEW.role_id, 'assigned_at', NEW.assigned_at)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active != NEW.is_active THEN
      INSERT INTO role_audit_logs (admin_email, action, target_user_email, role_id, details)
      VALUES (
        COALESCE(NEW.assigned_by, 'system'),
        CASE WHEN NEW.is_active THEN 'activate_role' ELSE 'deactivate_role' END,
        NEW.user_email,
        NEW.role_id,
        jsonb_build_object('previous_status', OLD.is_active, 'new_status', NEW.is_active)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO role_audit_logs (admin_email, action, target_user_email, role_id, details)
    VALUES (
      COALESCE(OLD.assigned_by, 'system'),
      'revoke_role',
      OLD.user_email,
      OLD.role_id,
      jsonb_build_object('revoked_at', NOW())
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_roles table
CREATE TRIGGER user_roles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION log_role_changes();

-- =====================================================
-- 16. GRANT PERMISSIONS
-- =====================================================
-- Grant necessary permissions to authenticated users
GRANT SELECT ON roles TO authenticated;
GRANT SELECT ON permissions TO authenticated;
GRANT SELECT ON role_permissions TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON user_team_assignments TO authenticated;
GRANT SELECT ON user_permission_overrides TO authenticated;
GRANT SELECT ON user_permissions_view TO authenticated;
GRANT SELECT ON user_team_assignments_view TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_permissions(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission(VARCHAR, VARCHAR) TO authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'AOI5 Roles Management System created successfully!';
  RAISE NOTICE 'Tables created: roles, permissions, role_permissions, user_roles, user_team_assignments, user_permission_overrides, role_audit_logs';
  RAISE NOTICE 'Functions created: get_user_permissions(), user_has_permission()';
  RAISE NOTICE 'Views created: user_permissions_view, user_team_assignments_view';
  RAISE NOTICE 'Default roles and permissions inserted';
  RAISE NOTICE 'Audit logging enabled';
END $$;

