import React from 'react';
import type { DashboardTile } from './dashboardConfig';
import { LauncherCard } from './LauncherCard';

interface LauncherGridProps {
  tiles: DashboardTile[];
  favoriteIds: string[];
  onOpen: (tile: DashboardTile) => void;
  onToggleFavorite: (tileId: string) => void;
  title?: string;
}

export function LauncherGrid({
  tiles,
  favoriteIds,
  onOpen,
  onToggleFavorite,
  title,
}: LauncherGridProps) {
  if (tiles.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={title || 'Launcher tiles'}>
      {title && (
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile) => (
          <LauncherCard
            key={tile.id}
            tile={tile}
            isFavorite={favoriteIds.includes(tile.id)}
            onOpen={onOpen}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
