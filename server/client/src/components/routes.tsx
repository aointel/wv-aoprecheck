import React from 'react';
import { 
  MdDashboard, 
  MdPhone, 
  MdVerifiedUser, 
  MdPayment,
  MdPeople,
  MdTrendingUp,
  MdSettings,
  MdCall,
  MdCalendarToday,
  MdEventAvailable,
  MdSchool
} from 'react-icons/md';

export interface IRoute {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  emailRestricted?: boolean;
}

export function getRoutesForUser(isAdmin: boolean = false, userEmail?: string): IRoute[] {
  const routes: IRoute[] = [
    {
      name: 'AO Intelligence',
      path: '/dashboard/aoi',
      icon: MdPhone
    },
    {
      name: 'Connect',
      path: '/dashboard/connect',
      icon: MdCall
    },
    {
      name: 'Calendar',
      path: '/dashboard/appointments',
      icon: MdCalendarToday
    },
    {
      name: 'Appointments',
      path: '/dashboard/appointments-manager',
      icon: MdEventAvailable
    }
  ];

  // AO Recruit and AO Precheck - visible to everyone
  routes.push(
    {
      name: 'AO Recruit',
      path: '/dashboard/aorecruit',
      icon: MdPeople
    },
    {
      name: 'AO Precheck',
      path: '/dashboard/aoprecheck',
      icon: MdVerifiedUser
    }
  );

  // Add admin-only routes
  if (isAdmin) {
    routes.push(
      {
        name: 'Verification Start',
        path: '/dashboard/verification-start',
        icon: MdVerifiedUser,
        adminOnly: true
      },
      {
        name: 'Call Center',
        path: '/dashboard/call-center',
        icon: MdCall,
        adminOnly: true
      },
      {
        name: 'User MGMT',
        path: '/dashboard/users',
        icon: MdPeople,
        adminOnly: true
      },
      {
        name: 'Leaderboard',
        path: '/dashboard/leaderboard',
        icon: MdTrendingUp,
        adminOnly: true
      },
      {
        name: 'Billing Dashboard',
        path: '/dashboard/billing-dashboard',
        icon: MdPayment,
        adminOnly: true
      },
      {
        name: 'Admin Portal',
        path: '/dashboard/admin',
        icon: MdSettings,
        adminOnly: true
      }
    );
  }

  // Settings always visible
  routes.push({
    name: 'Settings',
    path: '/dashboard/settings',
    icon: MdSettings
  });

  // Training always visible
  routes.push({
    name: 'Training',
    path: '/onboarding',
    icon: MdSchool
  });

  return routes;
}

  // Hidden development routes - commenting out as requested
  // if (userEmail && (userEmail.includes('@aoglobelife.com') || userEmail === 'test@aoprecheck.com')) {
  //   routes.push(
  //     {
  //       name: 'WebRTC Test',
  //       path: '/dashboard/webrtc-test',
  //       icon: <MdCall />
  //     },
  //     {
  //       name: 'Conference Test',
  //       path: '/dashboard/conference-test',
  //       icon: <MdCall />
  //     }
  //   );
  // }

  return routes;
}