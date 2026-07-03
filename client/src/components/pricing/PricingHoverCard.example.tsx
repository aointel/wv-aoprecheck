/**
 * Example usage of PricingHoverCard component
 * 
 * Wrap any element (text, button, icon, etc.) with PricingHoverCard
 * and it will show pricing information on hover
 */

import { PricingHoverCard } from './PricingHoverCard';
import { Button } from '@/components/ui/button';
import { MdPeople, MdPhone, MdVerifiedUser, MdDiamond, MdBusinessCenter } from 'react-icons/md';

// Example 1: Wrap a title/heading
export function ExampleTitle() {
  return (
    <div>
      <PricingHoverCard type="ao-recruit">
        <h1 className="text-3xl font-bold cursor-help">
          AO Recruit
        </h1>
      </PricingHoverCard>
    </div>
  );
}

// Example 2: Wrap a button
export function ExampleButton() {
  return (
    <PricingHoverCard type="connects">
      <Button variant="outline" className="cursor-help">
        Start Connect
      </Button>
    </PricingHoverCard>
  );
}

// Example 3: Wrap an icon with text
export function ExampleIcon() {
  return (
    <PricingHoverCard type="ao-precheck">
      <div className="flex items-center space-x-2 cursor-help">
        <MdVerifiedUser className="w-5 h-5" />
        <span>AO Precheck</span>
      </div>
    </PricingHoverCard>
  );
}

// Example 4: In a card header
export function ExampleCardHeader() {
  return (
    <div className="card">
      <div className="card-header">
        <PricingHoverCard type="call-connector-pro">
          <div className="flex items-center space-x-2 cursor-help">
            <MdDiamond className="w-5 h-5" />
            <h2>Call Connector Pro</h2>
          </div>
        </PricingHoverCard>
      </div>
    </div>
  );
}

// Example 5: In a navigation menu
export function ExampleNavItem() {
  return (
    <PricingHoverCard type="ao-meet">
      <div className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded cursor-help">
        <MdBusinessCenter className="w-5 h-5" />
        <span>AO Meet</span>
      </div>
    </PricingHoverCard>
  );
}


