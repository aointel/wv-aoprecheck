import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useDashboardState } from '@/hooks/useDashboardState';
import {
  DASHBOARD_TILES,
  HERO_SLIDES,
  PATHWAYS,
  UPDATES_FEED,
} from '@/components/dashboard/dashboardConfig';
import { HeroCarousel } from '@/components/dashboard/HeroCarousel';
import { UserContextPanel } from '@/components/dashboard/UserContextPanel';
import { LauncherGrid } from '@/components/dashboard/LauncherGrid';
import { PathwaysRow } from '@/components/dashboard/PathwaysRow';
import { UpdatesFeed } from '@/components/dashboard/UpdatesFeed';

function filterTilesBySearch(
  tiles: typeof DASHBOARD_TILES,
  query: string
): typeof DASHBOARD_TILES {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...tiles];
  return tiles.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
  );
}

function getTilesByCategory(
  tiles: typeof DASHBOARD_TILES,
  category: 'Core' | 'Operations' | 'Account'
) {
  return tiles.filter((t) => t.category === category);
}

export default function DashboardLandingPage() {
  const [, setLocation] = useLocation();
  const { authState } = useAuth();
  const {
    favorites,
    recents,
    searchQuery,
    setSearchQuery,
    credits,
    userEmail,
    toggleFavorite,
    trackRecent,
  } = useDashboardState();

  const userName =
    authState.profile?.firstName || authState.profile?.lastName
      ? [authState.profile?.firstName, authState.profile?.lastName]
          .filter(Boolean)
          .join(' ')
      : null;

  const filteredTiles = useMemo(
    () => filterTilesBySearch(DASHBOARD_TILES, searchQuery),
    [searchQuery]
  );

  const favoriteTiles = useMemo(
    () =>
      favorites
        .map((id) => filteredTiles.find((t) => t.id === id))
        .filter(Boolean) as typeof DASHBOARD_TILES,
    [favorites, filteredTiles]
  );

  const coreTiles = useMemo(
    () => getTilesByCategory(filteredTiles, 'Core'),
    [filteredTiles]
  );
  const operationsTiles = useMemo(
    () => getTilesByCategory(filteredTiles, 'Operations'),
    [filteredTiles]
  );
  const accountTiles = useMemo(
    () => getTilesByCategory(filteredTiles, 'Account'),
    [filteredTiles]
  );

  const hasAnyTiles =
    favoriteTiles.length > 0 ||
    coreTiles.length > 0 ||
    operationsTiles.length > 0 ||
    accountTiles.length > 0;

  const handleOpenTile = (tile: (typeof DASHBOARD_TILES)[0]) => {
    trackRecent(tile.id);
    setLocation(tile.href);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <UserContextPanel
        userEmail={userEmail}
        userName={userName}
        credits={credits}
        recentTileIds={recents}
        onRecentClick={trackRecent}
      />
      <main className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 gap-6 overflow-auto">
        <div className="flex justify-end">
          <div className="relative w-full max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search dashboard tiles"
            />
          </div>
        </div>

        <HeroCarousel slides={HERO_SLIDES} />

        {!hasAnyTiles ? (
          <div
            className="flex items-center justify-center py-12 text-muted-foreground"
            role="status"
          >
            No matching tools
          </div>
        ) : (
          <div className="space-y-8">
            {favoriteTiles.length > 0 && (
              <LauncherGrid
                tiles={favoriteTiles}
                favoriteIds={favorites}
                onOpen={handleOpenTile}
                onToggleFavorite={toggleFavorite}
                title="Favorites"
              />
            )}
            {coreTiles.length > 0 && (
              <LauncherGrid
                tiles={coreTiles}
                favoriteIds={favorites}
                onOpen={handleOpenTile}
                onToggleFavorite={toggleFavorite}
                title="Core"
              />
            )}
            {operationsTiles.length > 0 && (
              <LauncherGrid
                tiles={operationsTiles}
                favoriteIds={favorites}
                onOpen={handleOpenTile}
                onToggleFavorite={toggleFavorite}
                title="Operations"
              />
            )}
            {accountTiles.length > 0 && (
              <LauncherGrid
                tiles={accountTiles}
                favoriteIds={favorites}
                onOpen={handleOpenTile}
                onToggleFavorite={toggleFavorite}
                title="Account"
              />
            )}
          </div>
        )}

        <PathwaysRow pathways={PATHWAYS} />
        <UpdatesFeed items={UPDATES_FEED} />
      </main>
    </div>
  );
}
