import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import {
  loadFavorites,
  saveFavorites,
  loadRecents,
  saveRecents,
} from '@/utils/dashboardStorage';

const MOCK_CREDITS = 101;
const MAX_RECENTS = 6;

export function useDashboardState() {
  const { authState } = useAuth();
  const userEmail = (authState.user?.email || 'unknown').trim().toLowerCase();

  const [favorites, setFavoritesState] = useState<string[]>(() =>
    loadFavorites(userEmail)
  );
  const [recents, setRecentsState] = useState<string[]>(() =>
    loadRecents(userEmail)
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setFavoritesState(loadFavorites(userEmail));
    setRecentsState(loadRecents(userEmail));
  }, [userEmail]);

  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', userEmail],
    queryFn: async () => {
      const response = await fetch('/api/user/credits', {
        credentials: 'include',
        headers: { 'x-user-email': userEmail },
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!userEmail && userEmail !== 'unknown',
  });

  const credits =
    typeof (creditsData as any)?.credits_remaining === 'number'
      ? (creditsData as any).credits_remaining
      : MOCK_CREDITS;

  const toggleFavorite = useCallback(
    (tileId: string) => {
      setFavoritesState((prev) => {
        const next = prev.includes(tileId)
          ? prev.filter((id) => id !== tileId)
          : [...prev, tileId];
        saveFavorites(userEmail, next);
        return next;
      });
    },
    [userEmail]
  );

  const trackRecent = useCallback(
    (tileId: string) => {
      setRecentsState((prev) => {
        const filtered = prev.filter((id) => id !== tileId);
        const next = [tileId, ...filtered].slice(0, MAX_RECENTS);
        saveRecents(userEmail, next);
        return next;
      });
    },
    [userEmail]
  );

  const resetDashboardPersonalization = useCallback(() => {
    saveFavorites(userEmail, []);
    saveRecents(userEmail, []);
    setFavoritesState([]);
    setRecentsState([]);
  }, [userEmail]);

  return {
    favorites,
    recents,
    searchQuery,
    setSearchQuery,
    credits,
    userEmail,
    toggleFavorite,
    trackRecent,
    resetDashboardPersonalization,
  };
}
