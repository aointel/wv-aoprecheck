import { db } from './db';
import { rolePagePermissions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { PAGE_KEYS, type PageKey, type TeamRole } from '@shared/schema';

// No hardcoded admin roles

/**
 * SECURE PERMISSION RESOLVER - DEFAULT DENY, THEN ALLOW
 * 
 * Critical security: Non-admins get ZERO pages unless explicitly granted in database.
 * If database is missing/corrupted, non-admins are denied access (fail-closed).
 */

// Fixed cache structure to avoid type conflicts
const permissionCache = new Map<TeamRole, { pages: PageKey[]; updatedAt: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get allowed pages for a role using secure default-deny logic
 */
export async function getAllowedPages(role: TeamRole): Promise<PageKey[]> {
  try {
    // No admin overrides

    // Check cache first
    const now = Date.now();
    const cached = permissionCache.get(role);
    if (cached && (now - cached.updatedAt) < CACHE_TTL) {
      console.log(`🔐 Cache hit for role ${role} - ${cached.pages.length} pages`);
      return cached.pages;
    }

    // Query database for explicit permissions (DEFAULT DENY)
    const dbPermissions = await db
      .select({ page: rolePagePermissions.page })
      .from(rolePagePermissions)
      .where(and(
        eq(rolePagePermissions.role, role),
        eq(rolePagePermissions.allowed, true)
      ));

    const allowedPages = dbPermissions.map(p => p.page as PageKey);
    
    // Update cache
    permissionCache.set(role, { pages: allowedPages, updatedAt: now });

    console.log(`🔐 Role ${role} - database granted ${allowedPages.length} pages:`, allowedPages);
    return allowedPages;

  } catch (error) {
    console.error(`❌ Permission resolver error for role ${role}:`, error);
    
    // Default deny on any error (fail-closed security)
    
    console.log(`🔐 SECURITY: Denying all access for ${role} due to database error`);
    return [];
  }
}

/**
 * Check if a role can access a specific page
 */
export async function checkPageAccess(role: TeamRole, page: PageKey): Promise<boolean> {
  const allowedPages = await getAllowedPages(role);
  const hasAccess = allowedPages.includes(page);
  
  console.log(`🔐 Access check: ${role} → ${page} = ${hasAccess ? 'ALLOWED' : 'DENIED'}`);
  return hasAccess;
}

/**
 * Invalidate permission cache (call after admin updates)
 */
export function invalidatePermissionCache(): void {
  permissionCache.clear();
  console.log('🔐 Permission cache invalidated');
}

/**
 * Build secure permissions matrix for admin interface (DEFAULT DENY)
 */
export async function buildPermissionsMatrix(): Promise<Record<string, PageKey[]>> {
  try {
    const { ROLES } = await import('@shared/schema');
    const permissionsMatrix: Record<string, PageKey[]> = {};
    
    // Initialize all roles with empty permissions (DEFAULT DENY)
    for (const role of ROLES) {
      permissionsMatrix[role] = [];
    }
    
    // Get all permissions from database
    const dbPermissions = await db.select().from(rolePagePermissions);
    
    // Only add explicitly allowed permissions
    for (const perm of dbPermissions) {
      if (perm.allowed) {
        if (!permissionsMatrix[perm.role]) {
          permissionsMatrix[perm.role] = [];
        }
        
        if (!permissionsMatrix[perm.role].includes(perm.page as PageKey)) {
          permissionsMatrix[perm.role].push(perm.page as PageKey);
        }
      }
    }
    
    // No admin overrides in permissions matrix
    
    console.log('🔐 Built secure permissions matrix (default-deny)');
    return permissionsMatrix;
    
  } catch (error) {
    console.error('❌ Error building permissions matrix:', error);
    
    // CRITICAL: Return empty permissions for all roles on error (fail-closed)
    const { ROLES } = await import('@shared/schema');
    const emptyMatrix: Record<string, PageKey[]> = {};
    
    for (const role of ROLES) {
      emptyMatrix[role] = [];
    }
    
    return emptyMatrix;
  }
}

/**
 * Startup readiness check - verify permissions table exists and has data
 */
export async function verifyPermissionsSetup(): Promise<{ ready: boolean; error?: string }> {
  try {
    // Check if table exists and has data
    const permissions = await db.select().from(rolePagePermissions).limit(1);
    
    if (permissions.length === 0) {
      return { 
        ready: false, 
        error: 'role_page_permissions table is empty - no permissions configured' 
      };
    }

    console.log('🔐 Permissions system ready - database table verified');
    return { ready: true };

  } catch (error) {
    return { 
      ready: false, 
      error: `role_page_permissions table missing or inaccessible: ${error.message}` 
    };
  }
}