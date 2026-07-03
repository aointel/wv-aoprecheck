
import { useMemo } from 'react';
import { useAuth } from './use-auth';
import type { IRoute } from '@/components/routes';
import { 
  MdPhone, 
  MdVerifiedUser, 
  MdPayment,
  MdPeople,
  MdSettings,
  MdBarChart,
  MdCalendarToday,
  MdEventAvailable,
  MdAssessment,
  MdSwapHoriz,
  MdMonitor
} from 'react-icons/md';

// Visible routes only - hidden items removed
const ALL_ROUTES: IRoute[] = [
  {
    name: 'AO Intelligence',
    path: '/dashboard/aoi',
    icon: MdPhone
  },
  {
    name: 'AO Connect',
    path: '/dashboard/connect',
    icon: MdSwapHoriz
  },
  {
    name: 'AO Recruit',
    path: '/dashboard/ao-recruit',
    icon: MdPeople
  },
  {
    name: 'AO Precheck',
    path: '/dashboard/ao-precheck',
    icon: MdVerifiedUser
  }
  // Hidden: Settings, Live Call Board, Billing Dashboard, Admin, AO Precheck Admin, AOI Report, producer Billing, Demo Connections, Calendar, Appointments
];

/**
 * Hook that returns all routes for authenticated users - NO MORE RBAC
 */
export function useFilteredRoutes(): IRoute[] {
  const { authState } = useAuth();

  return useMemo(() => {
    // If user is authenticated, show ALL routes
    if (authState.user?.email) {
      console.log('🔓 SHOWING ALL ROUTES TO EVERYONE - NO RESTRICTIONS');
      return ALL_ROUTES;
    }
    
    // Not authenticated, show nothing
    return [];
  }, [authState.user]);
}

/**
 * Legacy function for backward compatibility - returns all routes
 */
export function getRoutesForUser(isAdmin: boolean = false, userEmail?: string): IRoute[] {
  return ALL_ROUTES;
}
