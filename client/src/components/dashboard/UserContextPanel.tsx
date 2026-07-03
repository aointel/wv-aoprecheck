import React from 'react';
import { Link } from 'wouter';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DASHBOARD_TILES } from './dashboardConfig';
import { cn } from '@/lib/utils';

interface UserContextPanelProps {
  userEmail: string;
  userName?: string | null;
  credits: number;
  recentTileIds: string[];
  onRecentClick?: (tileId: string) => void;
}

function getInitials(email: string, userName?: string | null): string {
  if (userName && userName.trim()) {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const local = (email || '').split('@')[0] || '?';
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return local.toUpperCase() || '?';
}

export function UserContextPanel({
  userEmail,
  userName,
  credits,
  recentTileIds,
  onRecentClick,
}: UserContextPanelProps) {
  const initials = getInitials(userEmail, userName);
  const recentTiles = recentTileIds
    .map((id) => DASHBOARD_TILES.find((t) => t.id === id))
    .filter(Boolean) as typeof DASHBOARD_TILES;

  return (
    <aside
      className="w-56 shrink-0 flex flex-col gap-4 p-4 border-r bg-muted/30"
      aria-label="User context and quick actions"
    >
      <div className="flex flex-col items-center gap-2">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <p
          className="text-sm font-medium text-center truncate w-full px-1"
          title={userEmail}
        >
          {userEmail}
        </p>
      </div>

      <div className="rounded-lg bg-card border p-3">
        <p className="text-xs text-muted-foreground mb-1">Credits</p>
        <p className="text-xl font-semibold">{credits.toLocaleString()}</p>
        <Link href="/dashboard/billing-dashboard">
          <Button
            variant="default"
            size="sm"
            className="w-full mt-2"
            aria-label="Buy credits"
          >
            Buy
          </Button>
        </Link>
      </div>

      <Link href="/help">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          aria-label="Get support"
        >
          Get Support
        </Button>
      </Link>

      {recentTiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Recent
          </h3>
          <ul className="space-y-1" role="list">
            {recentTiles.map((tile) => (
              <li key={tile.id}>
                <Link href={tile.href}>
                  <a
                    className={cn(
                      'block text-sm py-1.5 px-2 rounded-md truncate',
                      'hover:bg-muted transition-colors'
                    )}
                    onClick={() => onRecentClick?.(tile.id)}
                    aria-label={`Open ${tile.title}`}
                  >
                    {tile.title}
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
