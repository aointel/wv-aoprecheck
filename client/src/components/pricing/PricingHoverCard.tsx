import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MdPhone, 
  MdCheck, 
  MdStar,
  MdBusinessCenter,
  MdDiamond,
  MdPeople,
  MdVerifiedUser
} from 'react-icons/md';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface PricingCardProps {
  type: 'connects' | 'ao-recruit' | 'ao-precheck' | 'call-connector-pro' | 'ao-meet';
  children: React.ReactNode;
  showHowItWorks?: boolean;
  linkClassName?: string;
}

const pricingData = {
  'connects': {
    title: 'Connects',
    icon: MdPhone,
    price: '$8',
    unit: 'per connection',
    description: 'Successful connections from VDP calls',
    features: [
      'Successful VDP call connections',
      'Real-time tracking & analytics',
      'Automatic billing'
    ],
    color: 'blue',
    bgClass: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20',
    iconClass: 'text-blue-600'
  },
  'ao-recruit': {
    title: 'AO Recruit',
    icon: MdPeople,
    price: '$5',
    unit: 'per connection',
    description: 'Recruiting pipeline and prospect management',
    features: [
      'Recruit call automation',
      'Prospect management',
      'Booking & onboarding'
    ],
    color: 'green',
    bgClass: 'from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20',
    iconClass: 'text-green-600'
  },
  'ao-precheck': {
    title: 'AO Precheck',
    icon: MdVerifiedUser,
    price: '$3',
    unit: 'per check',
    description: 'Verification and pre-check services',
    features: [
      'Policy verification',
      'Review & approval',
      'Submission management'
    ],
    color: 'purple',
    bgClass: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20',
    iconClass: 'text-purple-600'
  },
  'call-connector-pro': {
    title: 'Call Connector Pro',
    icon: MdDiamond,
    price: '$64.99',
    unit: '/month',
    description: 'Professional outbound dialing with local presence',
    features: [
      'Professional outbound dialing',
      'Local Presence EVERY STATE.. Take your activity to the next level!',
      'Advanced analytics',
      'HotLead assignment',
      'Priority support'
    ],
    color: 'primary',
    bgClass: 'from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30',
    iconClass: 'text-primary',
    popular: true
  },
  'ao-meet': {
    title: 'AO Meet',
    icon: MdBusinessCenter,
    price: '$15.00',
    unit: '/month',
    description: 'Video meeting and collaboration platform',
    features: [
      'Video meeting platform',
      'Screen sharing',
      'Collaboration tools',
      'Meeting scheduling'
    ],
    color: 'amber',
    bgClass: 'from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20',
    iconClass: 'text-amber-600'
  }
};

const PricingCardContent = ({ data }: { data: typeof pricingData[keyof typeof pricingData] }) => {
  const IconComponent = data.icon;
  
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className={`bg-gradient-to-br ${data.bgClass} ${data.popular ? 'pt-12' : ''}`}>
        {data.popular && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white text-center py-2 text-sm font-medium">
            ⭐ MOST POPULAR
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IconComponent className={`w-6 h-6 ${data.iconClass}`} />
            <CardTitle className="text-xl">{data.title}</CardTitle>
          </div>
          {data.popular && (
            <Badge className="bg-primary text-primary-foreground">
              <MdStar className="w-3 h-3 mr-1" />
              Best Value
            </Badge>
          )}
        </div>
        <CardDescription className="text-base">
          {data.description}
        </CardDescription>
        <div className="flex items-baseline space-x-2 mt-2">
          <span className="text-4xl font-bold">{data.price}</span>
          <span className="text-lg text-muted-foreground">{data.unit}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        <div className="space-y-2">
          {data.features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-2">
              <MdCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function PricingHoverCard({ type, children, showHowItWorks = false, linkClassName }: PricingCardProps) {
  const data = pricingData[type];
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (showHowItWorks) {
    const defaultLinkClass = linkClassName || "h-auto p-0 text-sm text-muted-foreground hover:text-primary underline";
    return (
      <div className="flex items-center space-x-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            {children}
          </HoverCardTrigger>
          <HoverCardContent className="w-96 p-0" side="right" align="start" sideOffset={10}>
            <PricingCardContent data={data} />
          </HoverCardContent>
        </HoverCard>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="link" 
              className={defaultLinkClass}
            >
              (How's it work?)
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" side="right" align="start">
            <PricingCardContent data={data} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-96 p-0" side="right" align="start" sideOffset={10}>
        <PricingCardContent data={data} />
      </HoverCardContent>
    </HoverCard>
  );
}

