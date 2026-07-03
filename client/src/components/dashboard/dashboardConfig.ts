import type { LucideIcon } from 'lucide-react';
import {
  Phone,
  Users,
  Shield,
  Calendar,
  Gauge,
  CreditCard,
  Settings,
  GraduationCap,
  LayoutDashboard,
} from 'lucide-react';

export type DashboardTileCategory = 'Core' | 'Operations' | 'Account';

export interface DashboardTile {
  id: string;
  title: string;
  description: string;
  href: string;
  category: DashboardTileCategory;
  iconKey: string;
  badge?: string;
  requiresRole?: string[];
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageKey: string;
}

export interface PathwayStep {
  label: string;
  href: string;
}

export interface Pathway {
  id: string;
  title: string;
  subtitle: string;
  steps: PathwayStep[];
  href: string;
}

export interface UpdateItem {
  id: string;
  date: string;
  title: string;
  href?: string;
}

export const DASHBOARD_TILES: DashboardTile[] = [
  // Core
  {
    id: 'ao-intel',
    title: 'AO Intel',
    description: 'Call Connector Pro – dialer and hot leads',
    href: '/dashboard/connect',
    category: 'Core',
    iconKey: 'phone',
  },
  {
    id: 'precheck',
    title: 'Precheck',
    description: 'Run eligibility and verification',
    href: '/dashboard/verification-start',
    category: 'Core',
    iconKey: 'shield',
  },
  {
    id: 'live-call-board',
    title: 'Live Call Board',
    description: 'Real-time calls and agent status',
    href: '/dashboard/live-call-board',
    category: 'Core',
    iconKey: 'gauge',
  },
  {
    id: 'meet',
    title: 'Meet',
    description: 'Schedule and manage meetings',
    href: '/dashboard/meet',
    category: 'Core',
    iconKey: 'calendar',
  },
  // Operations
  {
    id: 'recruit',
    title: 'Recruit',
    description: 'Recruiting and candidate pipeline',
    href: '/dashboard/ao-recruit',
    category: 'Operations',
    iconKey: 'users',
  },
  {
    id: 'ao-precheck-admin',
    title: 'AO Precheck Admin',
    description: 'Precheck management and admin',
    href: '/dashboard/aoi-precheck-admin',
    category: 'Operations',
    iconKey: 'shield',
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Credits and payments',
    href: '/dashboard/billing-dashboard',
    category: 'Operations',
    iconKey: 'creditcard',
  },
  {
    id: 'billing-dashboard',
    title: 'Billing Dashboard',
    description: 'Usage, invoices, and credits',
    href: '/dashboard/billing-dashboard',
    category: 'Operations',
    iconKey: 'layout-dashboard',
  },
  // Account
  {
    id: 'settings',
    title: 'Settings',
    description: 'Account and app settings',
    href: '/dashboard/settings',
    category: 'Account',
    iconKey: 'settings',
  },
  {
    id: 'training',
    title: 'Training',
    description: 'Updates and recordings',
    href: '/onboarding',
    category: 'Account',
    iconKey: 'graduation-cap',
  },
];

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'ao-intel',
    title: 'AO Intel',
    subtitle: "Today's activity and hot leads",
    href: '/dashboard/connect',
    imageKey: 'gradient-blue',
  },
  {
    id: 'live-call-board',
    title: 'Live Call Board',
    subtitle: 'Real-time calls and agent status',
    href: '/dashboard/live-call-board',
    imageKey: 'gradient-amber',
  },
  {
    id: 'precheck',
    title: 'Precheck',
    subtitle: 'Run eligibility and verification',
    href: '/dashboard/verification-start',
    imageKey: 'gradient-purple',
  },
  {
    id: 'billing',
    title: 'Billing',
    subtitle: 'Credits, invoices, usage',
    href: '/dashboard/billing-dashboard',
    imageKey: 'gradient-orange',
  },
  {
    id: 'training',
    title: 'Training',
    subtitle: 'Updates and recordings',
    href: '/onboarding',
    imageKey: 'gradient-sky',
  },
];

export const PATHWAYS: Pathway[] = [
  {
    id: 'new-agent',
    title: 'New Agent Setup Path',
    subtitle: 'Get started quickly',
    steps: [
      { label: 'Meet', href: '/dashboard/meet' },
      { label: 'Training', href: '/onboarding' },
      { label: 'Settings', href: '/dashboard/settings' },
    ],
    href: '/dashboard/meet',
  },
  {
    id: 'precheck-pro',
    title: 'Run Precheck Like a Pro',
    subtitle: 'Eligibility and verification',
    steps: [
      { label: 'Precheck', href: '/dashboard/verification-start' },
      { label: 'Admin', href: '/dashboard/aoi-precheck-admin' },
      { label: 'Training', href: '/onboarding' },
    ],
    href: '/dashboard/verification-start',
  },
  {
    id: 'scale-calling',
    title: 'Scale Calling Ops',
    subtitle: 'Board, intel, and billing',
    steps: [
      { label: 'Live Call Board', href: '/dashboard/live-call-board' },
      { label: 'AO Intel', href: '/dashboard/connect' },
      { label: 'Billing Dashboard', href: '/dashboard/billing-dashboard' },
    ],
    href: '/dashboard/live-call-board',
  },
];

export const UPDATES_FEED: UpdateItem[] = [
  { id: '1', date: '2025-02-01', title: 'Dashboard launcher available', href: '/dashboard' },
  { id: '2', date: '2025-01-28', title: 'Live Call Board improvements', href: '/dashboard/live-call-board' },
  { id: '3', date: '2025-01-25', title: 'Precheck workflow updates', href: '/dashboard/verification-start' },
  { id: '4', date: '2025-01-20', title: 'Billing dashboard refresh', href: '/dashboard/billing-dashboard' },
  { id: '5', date: '2025-01-15', title: 'Training resources updated', href: '/onboarding' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  phone: Phone,
  users: Users,
  shield: Shield,
  calendar: Calendar,
  gauge: Gauge,
  creditcard: CreditCard,
  settings: Settings,
  'graduation-cap': GraduationCap,
  'layout-dashboard': LayoutDashboard,
};

export function getTileIcon(iconKey: string): LucideIcon {
  const key = (iconKey || '').toLowerCase().replace(/\s+/g, '-');
  return ICON_MAP[key] ?? Settings;
}
