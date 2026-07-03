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
  MdBarChart,
  MdCalendarToday,
  MdDownload,
  MdEventAvailable,
  MdGroups,
  MdAssessment,
  MdAnalytics,
  MdEmojiEvents,
  MdMap,
  MdSwapHoriz,
  MdMonitor,
  MdSlideshow,
  MdPlayCircle,
  MdVideoLibrary,
  MdAccessTime,
  MdSpeed,
  MdSchool,
  MdCloudUpload
} from 'react-icons/md';

export interface IRoute {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  emailRestricted?: boolean;
  subItems?: IRoute[];
  accentClass?: string;
  iconClass?: string;
}

export function getRoutesForUser(isAdmin: boolean = false, userEmail?: string): IRoute[] {
  // Special access for richiealtig@aoglobelife.com - FULL ACCESS TO EVERYTHING
  if (userEmail === 'richiealtig@aoglobelife.com') {
    return getAllRoutesForSysOp(); // Give him everything like cnsysop
  }
  
  // Special access for specific users - default routes + Live Call Board
  // Special sidebar for these users (Meet removed from nav for now)
  if (userEmail === 'carringtonhanna@aoglobelife.com' || 
      userEmail === 'leynatran@aoglobelife.com' ||
      userEmail === 'kingsleyibeh@aoglobelife.com' ||
      userEmail === 'chrisfanning@aoglobelife.com') {
    return [
      {
        name: 'AO Intel',
        path: '/dashboard/connect',
        icon: MdPhone,
        accentClass: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent',
        iconClass: 'text-blue-500'
      },
      {
        name: 'Recruit',
        path: '/dashboard/ao-recruit',
        icon: MdPeople,
        accentClass: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 bg-clip-text text-transparent',
        iconClass: 'text-emerald-500'
      },
      {
        name: 'Precheck',
        path: '/dashboard/verification-start',
        icon: MdVerifiedUser,
        accentClass: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent',
        iconClass: 'text-purple-500'
      },
      {
        name: 'Billing',
        path: '/dashboard/billing-dashboard',
        icon: MdPayment,
        accentClass: 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent',
        iconClass: 'text-orange-500'
      },
      {
        name: 'Training',
        path: '/onboarding',
        icon: MdSchool,
        accentClass: 'bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-600 bg-clip-text text-transparent',
        iconClass: 'text-sky-500'
      }
    ];
  }
  
  // Return only visible routes - hide specified items
  // NOTE: "Meet" removed from left navbar for now
  const routes: IRoute[] = [
      {
        name: 'AO Intel',
        path: '/dashboard/connect',
        icon: MdPhone,
        accentClass: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent',
        iconClass: 'text-blue-500'
      },
      {
        name: 'Recruit',
        path: '/dashboard/ao-recruit',
        icon: MdPeople,
        accentClass: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 bg-clip-text text-transparent',
        iconClass: 'text-emerald-500'
      },
      {
        name: 'Precheck',
        path: '/dashboard/verification-start',
        icon: MdVerifiedUser,
        accentClass: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent',
        iconClass: 'text-purple-500'
      },
      {
        name: 'Billing',
        path: '/dashboard/billing-dashboard',
        icon: MdPayment,
        accentClass: 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent',
        iconClass: 'text-orange-500'
      },
      {
        name: 'Training',
        path: '/onboarding',
        icon: MdSchool,
        accentClass: 'bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-600 bg-clip-text text-transparent',
        iconClass: 'text-sky-500'
      }
    // Hidden items: Live Call Board, Settings, Billing Dashboard, Admin, AOI Report, producer Billing, Demo Connections, Calendar, Appointments, My Presentations, AO Present, Presentation History
  ];

  return routes;
}

/**
 * Get ALL routes for cnsysop - full access to everything
 */
export function getAllRoutesForSysOp(): IRoute[] {
  const routes: IRoute[] = [
    {
      name: 'AO Intel',
      path: '/dashboard/connect',
      icon: MdPhone,
      accentClass: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent',
      iconClass: 'text-blue-500'
    },
    {
      name: 'Recruit',
      path: '/dashboard/ao-recruit',
      icon: MdPeople,
      accentClass: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 bg-clip-text text-transparent',
      iconClass: 'text-emerald-500'
    },
    {
      name: 'Precheck',
      path: '/dashboard/verification-start',
      icon: MdVerifiedUser,
      accentClass: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent',
      iconClass: 'text-purple-500'
    },
    {
      name: 'AO Precheck Admin',
      path: '/dashboard/aoi-precheck-admin',
      icon: MdMonitor,
      accentClass: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent',
      iconClass: 'text-purple-500'
    },
      {
        name: 'Billing',
        path: '/dashboard/billing-dashboard',
        icon: MdPayment,
        accentClass: 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent',
        iconClass: 'text-orange-500'
      },
      {
        name: 'Billing Dashboard',
        path: '/dashboard/billing-dashboard',
        icon: MdPayment,
        accentClass: 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent',
        iconClass: 'text-orange-500'
      },
      {
        name: 'Settings',
        path: '/dashboard/settings',
        icon: MdSettings,
        accentClass: 'bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500 bg-clip-text text-transparent',
        iconClass: 'text-slate-500'
      },
      {
        name: 'Training',
        path: '/onboarding',
        icon: MdSchool,
        accentClass: 'bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-600 bg-clip-text text-transparent',
        iconClass: 'text-sky-500'
      },
      {
        name: 'Conf Test',
        path: '/conference-test',
        icon: MdPhone,
        accentClass: 'bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 bg-clip-text text-transparent',
        iconClass: 'text-yellow-500'
      },
  ];

  return routes;
}

/**
 * Get routes for Quality Managers - includes AO Precheck Admin
 */
export function getRoutesForQualityManager(): IRoute[] {
  const baseRoutes = getRoutesForUser();
  
  // Add AO Precheck Admin and Presentation Analytics for Quality Managers
  const qualityManagerRoutes = [
    ...baseRoutes,
    {
      name: 'AO Precheck Admin',
      path: '/dashboard/aoi-precheck-admin',
      icon: MdMonitor,
      accentClass: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent',
      iconClass: 'text-purple-500'
    },
    {
      name: 'Presentation Analytics',
      path: '/dashboard/presentation-analytics',
      icon: MdSlideshow,
      accentClass: 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 bg-clip-text text-transparent',
      iconClass: 'text-indigo-500'
    }
  ];

  return qualityManagerRoutes;
}
/**
 * Get routes for Super Quality Managers (AO Quality Managers)
 * They ONLY see AO Precheck Management - no other menu items
 */
export function getRoutesForSuperQualityManager(): IRoute[] {
  return [
    {
      name: 'AO Precheck Management',
      path: '/dashboard/aoi-precheck-admin',
      icon: MdMonitor,
      accentClass: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent',
      iconClass: 'text-purple-500'
    },
    {
      name: 'Training',
      path: '/onboarding',
      icon: MdSchool,
      accentClass: 'bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-600 bg-clip-text text-transparent',
      iconClass: 'text-sky-500'
    }
  ];
}
