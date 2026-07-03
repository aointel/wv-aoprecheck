# AOI5 Supabase Roles Management System

A comprehensive roles and permissions management system built on Supabase for the AOI5 application.

## 🏗️ Architecture Overview

The system consists of three main components:
1. **Database Schema** - Supabase tables and functions
2. **Backend Service** - TypeScript service for API interactions
3. **Frontend Hook** - React hook for permission checking

## 📊 Database Schema

### Core Tables

#### 1. `roles`
Stores role definitions with hierarchical levels.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER DEFAULT 0, -- 0=agent, 1=manager, 2=admin, 3=super_admin
  is_active BOOLEAN DEFAULT true,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. `permissions`
Stores granular permissions organized by category.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'page', 'feature', 'data', 'admin'
  resource VARCHAR(100), -- Specific resource (e.g., 'leads', 'calls')
  action VARCHAR(50), -- 'read', 'write', 'delete', 'manage'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. `role_permissions`
Many-to-many relationship between roles and permissions.

#### 4. `user_roles`
Many-to-many relationship between users and roles.

#### 5. `user_team_assignments`
Team-based permissions for MGA/RGA/Quality teams.

#### 6. `user_permission_overrides`
Individual permission overrides for specific users.

#### 7. `role_audit_logs`
Comprehensive audit logging for all role changes.

### Database Functions

#### `get_user_permissions(user_email_param VARCHAR)`
Returns all effective permissions for a user, including role-based and override permissions.

#### `user_has_permission(user_email_param VARCHAR, permission_name_param VARCHAR)`
Checks if a user has a specific permission, respecting deny overrides.

## 🔧 Backend Service

### SupabaseRolesService

Located in `server/supabase-roles-service.ts`, this service provides:

#### Role Management
- `getRoles()` - Get all active roles
- `getRoleByName(name)` - Get role by name
- `createRole(roleData)` - Create new role
- `updateRole(id, updates)` - Update existing role
- `deleteRole(id)` - Soft delete role

#### Permission Management
- `getPermissions()` - Get all permissions
- `getPermissionsByCategory(category)` - Get permissions by category

#### User Role Management
- `getUserRoles(email)` - Get user's roles
- `assignRoleToUser(email, roleId, assignedBy, expiresAt?)` - Assign role
- `removeRoleFromUser(email, roleId)` - Remove role

#### Permission Checking
- `getUserPermissions(email)` - Get user's effective permissions
- `userHasPermission(email, permissionName)` - Check specific permission
- `userCanAccessPage(email, pageName)` - Check page access
- `userCanPerformAction(email, resource, action)` - Check action permission

#### Team Management
- `getUserTeamAssignments(email)` - Get user's team assignments
- `assignUserToTeam(email, teamType, teamName, assignedBy)` - Assign to team
- `removeUserFromTeam(email, teamType, teamName)` - Remove from team

#### Permission Overrides
- `getUserPermissionOverrides(email)` - Get user's overrides
- `grantPermissionOverride(email, permissionId, reason, grantedBy, expiresAt?)` - Grant override
- `denyPermissionOverride(email, permissionId, reason, grantedBy, expiresAt?)` - Deny override

#### Audit Logging
- `getAuditLogs(limit, offset, adminEmail?, targetUserEmail?)` - Get audit logs
- `logAdminAction(adminEmail, action, targetUserEmail?, roleId?, permissionId?, details?, ipAddress?, userAgent?)` - Log action

### API Routes

Located in `server/roles-api-routes.ts`, provides RESTful endpoints:

```
GET    /api/roles                           # Get all roles
GET    /api/roles/:name                     # Get role by name
POST   /api/roles                           # Create role
PUT    /api/roles/:id                       # Update role
DELETE /api/roles/:id                       # Delete role

GET    /api/permissions                     # Get all permissions
GET    /api/permissions/category/:category  # Get permissions by category

GET    /api/users/:email/roles              # Get user roles
POST   /api/users/:email/roles              # Assign role to user
DELETE /api/users/:email/roles/:roleId      # Remove role from user

GET    /api/users/:email/permissions        # Get user permissions
GET    /api/users/:email/permissions/check  # Check specific permission
GET    /api/users/:email/pages/:pageName/access  # Check page access
GET    /api/users/:email/actions/:resource/:action/check  # Check action permission

GET    /api/users/:email/teams              # Get user team assignments
POST   /api/users/:email/teams              # Assign user to team
DELETE /api/users/:email/teams/:teamType/:teamName  # Remove from team

GET    /api/users/:email/overrides          # Get permission overrides
POST   /api/users/:email/overrides/grant    # Grant permission override
POST   /api/users/:email/overrides/deny     # Deny permission override

GET    /api/audit-logs                      # Get audit logs
```

## ⚛️ Frontend Integration

### useSupabasePermissions Hook

Located in `client/src/hooks/use-supabase-permissions.tsx`, provides:

#### Local Permission Checking
```typescript
const {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessPage,
  canPerformAction,
  hasRole,
  hasAnyRole,
  isAdmin,
  isSuperAdmin,
  getTeamAssignments,
  isAssignedToTeam
} = useSupabasePermissions();

// Check permissions
const canViewLeads = hasPermission('feature.view_leads');
const canAccessDashboard = canAccessPage('dashboard');
const canManageUsers = canPerformAction('admin', 'manage_users');

// Check roles
const isUserAdmin = isAdmin();
const isUserManager = hasRole('manager');

// Check team assignments
const mgaTeams = getTeamAssignments('mga');
const isInTeam = isAssignedToTeam('mga', 'Team Alpha');
```

#### API Permission Checking
```typescript
const { checkPermission, checkPageAccess } = useSupabasePermissions();

// Check with API call
const result = await checkPermission('feature.view_leads');
if (result.hasPermission) {
  // User has permission
}
```

### PermissionWrapper Component

```typescript
import { PermissionWrapper, PERMISSIONS, ROLES } from './use-supabase-permissions';

// Page access
<PermissionWrapper page="dashboard">
  <Dashboard />
</PermissionWrapper>

// Permission-based
<PermissionWrapper permission={PERMISSIONS.VIEW_LEADS}>
  <LeadsList />
</PermissionWrapper>

// Role-based
<PermissionWrapper role={ROLES.ADMIN}>
  <AdminPanel />
</PermissionWrapper>

// Multiple permissions (any)
<PermissionWrapper permissions={[PERMISSIONS.VIEW_LEADS, PERMISSIONS.MANAGE_LEADS]}>
  <LeadsManagement />
</PermissionWrapper>

// Multiple permissions (all)
<PermissionWrapper permissions={[PERMISSIONS.VIEW_LEADS, PERMISSIONS.VIEW_CALLS]} requireAll>
  <CombinedView />
</PermissionWrapper>

// Team-based
<PermissionWrapper teamType="mga" teamName="Team Alpha">
  <TeamDashboard />
</PermissionWrapper>

// With fallback
<PermissionWrapper permission={PERMISSIONS.ADMIN_PANEL} fallback={<div>Access Denied</div>}>
  <AdminPanel />
</PermissionWrapper>
```

## 🚀 Setup Instructions

### 1. Create Database Schema

Run the SQL script in Supabase:

```bash
# Execute the SQL file in Supabase SQL Editor
psql -f create-supabase-roles-management.sql
```

### 2. Add API Routes

Add the roles API routes to your Express app:

```typescript
// In server/index.ts or server/routes.ts
import rolesApiRoutes from './roles-api-routes';

app.use('/api', rolesApiRoutes);
```

### 3. Initialize Default Data

The SQL script automatically creates:
- 6 default roles (super_admin, admin, manager, quality_manager, ao_quality_manager, agent)
- 20+ default permissions organized by category
- Role-permission assignments
- Database functions and triggers

### 4. Use in Frontend

```typescript
// In your React components
import { useSupabasePermissions, PermissionWrapper, PERMISSIONS } from './hooks/use-supabase-permissions';

function MyComponent() {
  const { hasPermission, canAccessPage, isAdmin } = useSupabasePermissions();
  
  return (
    <div>
      {canAccessPage('dashboard') && <Dashboard />}
      {hasPermission(PERMISSIONS.VIEW_LEADS) && <LeadsList />}
      {isAdmin() && <AdminPanel />}
    </div>
  );
}
```

## 🔐 Security Features

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies.

### Audit Logging
Every role change is logged with:
- Admin who made the change
- Target user
- Action performed
- Timestamp
- IP address and user agent
- Additional details

### Permission Hierarchy
- Super Admin (level 3): All permissions
- Admin (level 2): Most permissions except super admin functions
- Manager (level 1): Team management and reporting
- Quality Manager (level 1): Quality assurance functions
- Agent (level 0): Basic operational permissions

### Override System
- Individual users can have permissions granted or denied
- Overrides take precedence over role permissions
- Deny overrides always win over grant overrides
- Overrides can have expiration dates

## 📈 Performance Considerations

### Caching
- Frontend hook caches permissions locally
- Database functions are optimized for performance
- Indexes on frequently queried columns

### Database Indexes
- `user_roles(user_email, is_active)`
- `role_permissions(role_id, permission_id)`
- `user_team_assignments(user_email, team_type, team_name)`
- `role_audit_logs(admin_email, created_at)`

### Query Optimization
- Use database functions for complex permission checks
- Batch permission checks when possible
- Limit audit log queries with pagination

## 🔄 Migration from Current System

### Phase 1: Database Setup
1. Run the SQL script to create tables
2. Verify default roles and permissions are created
3. Test database functions

### Phase 2: Backend Integration
1. Add the roles service to your server
2. Add API routes
3. Update existing permission checks to use new system

### Phase 3: Frontend Integration
1. Add the permissions hook
2. Replace existing permission checks
3. Add PermissionWrapper components

### Phase 4: User Migration
1. Assign existing users to appropriate roles
2. Set up team assignments
3. Configure any necessary overrides

## 🧪 Testing

### Unit Tests
Test individual service methods and hook functions.

### Integration Tests
Test API endpoints and database functions.

### Permission Tests
Verify permission checking works correctly for different user types.

## 📚 Examples

### Creating a Custom Role
```typescript
const customRole = await SupabaseRolesService.createRole({
  name: 'senior_agent',
  display_name: 'Senior Agent',
  description: 'Experienced agent with additional permissions',
  level: 1,
  is_active: true,
  is_system_role: false
});
```

### Assigning Role to User
```typescript
await SupabaseRolesService.assignRoleToUser(
  'user@example.com',
  roleId,
  'admin@example.com',
  '2024-12-31T23:59:59Z' // Optional expiration
);
```

### Checking Complex Permissions
```typescript
const canManageTeamLeads = hasAllPermissions([
  PERMISSIONS.VIEW_LEADS,
  PERMISSIONS.MANAGE_LEADS,
  PERMISSIONS.VIEW_TEAM_LEADS
]);
```

This roles management system provides a robust, scalable foundation for managing user access across the AOI5 application while maintaining security and auditability.

