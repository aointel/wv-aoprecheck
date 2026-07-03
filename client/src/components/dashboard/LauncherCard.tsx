import React from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DashboardTile } from './dashboardConfig';
import { getTileIcon } from './dashboardConfig';

interface LauncherCardProps {
  tile: DashboardTile;
  isFavorite: boolean;
  onOpen: (tile: DashboardTile) => void;
  onToggleFavorite: (tileId: string) => void;
}

export function LauncherCard({
  tile,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: LauncherCardProps) {
  const Icon = getTileIcon(tile.iconKey);

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button[data-favorite]')) return;
    onOpen(tile);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if ((e.target as HTMLElement).getAttribute('data-favorite') !== 'true') {
        onOpen(tile);
      }
    }
  };

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
      )}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      aria-label={`Open ${tile.title}`}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg leading-tight truncate">
                {tile.title}
              </h3>
              {tile.badge && (
                <Badge variant="secondary" className="mt-0.5 text-xs">
                  {tile.badge}
                </Badge>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 opacity-70 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(tile.id);
            }}
            data-favorite="true"
            aria-label={isFavorite ? `Remove ${tile.title} from favorites` : `Add ${tile.title} to favorites`}
          >
            <Star
              className={cn('h-4 w-4', isFavorite && 'fill-amber-400 text-amber-500')}
              aria-hidden
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {tile.description}
        </p>
        <span className="text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Open
        </span>
      </CardContent>
    </Card>
  );
}
