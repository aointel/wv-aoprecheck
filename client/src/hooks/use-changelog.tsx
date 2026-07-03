import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ChangelogEntry } from '@/components/changelog/ChangelogModal';

interface UseChangelogReturn {
  entries: ChangelogEntry[];
  unreadEntries: ChangelogEntry[];
  isLoading: boolean;
  markAsViewed: (entryId: string) => Promise<void>;
  dismissEntry: (entryId: string) => Promise<void>;
}

export function useChangelog(userEmail: string | undefined): UseChangelogReturn {
  const [viewedEntryIds, setViewedEntryIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch changelog entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['changelog-entries'],
    queryFn: async () => {
      if (!supabase) return [];

      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('changelog_entries')
        .select('*')
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order('published_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Failed to fetch changelog entries:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        // If table doesn't exist, return empty array (don't crash)
        if (error.code === '42P01') {
          console.warn('⚠️ changelog_entries table does not exist. Run create-changelog-table.sql in Supabase.');
        }
        return [];
      }

      return (data || []).map((entry: any) => ({
        id: entry.id,
        version: entry.version,
        title: entry.title,
        description: entry.description,
        items: Array.isArray(entry.items) ? entry.items : [],
        priority: entry.priority || 'normal',
        published_at: entry.published_at,
      })) as ChangelogEntry[];
    },
    enabled: !!supabase,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch viewed entries for this user
  const { data: viewedEntries = [], refetch: refetchViews } = useQuery({
    queryKey: ['changelog-views', userEmail],
    queryFn: async () => {
      if (!supabase || !userEmail) return [];

      const { data, error } = await supabase
        .from('changelog_views')
        .select('changelog_entry_id, dismissed, viewed_at')
        .eq('agent_email', userEmail.toLowerCase());

      if (error) {
        console.error('Failed to fetch changelog views:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!supabase && !!userEmail,
    refetchInterval: 60 * 1000, // Refetch every 60s; was 2s and caused log spam + re-render storm
    staleTime: 30 * 1000,
  });

  // Update viewedEntryIds whenever viewedEntries data changes
  useEffect(() => {
    if (viewedEntries && viewedEntries.length >= 0) {
      const viewed = new Set(
        viewedEntries
          .filter((v: any) => v.dismissed || v.viewed_at)
          .map((v: any) => v.changelog_entry_id)
      );
      setViewedEntryIds(viewed);
    }
  }, [viewedEntries]);

  // Mark entry as viewed
  const markAsViewed = async (entryId: string) => {
    if (!supabase || !userEmail) return;

    try {
      // IMMEDIATELY update local state first for instant UI feedback
      setViewedEntryIds(prev => new Set(prev).add(entryId));
      
      const { error } = await supabase
        .from('changelog_views')
        .upsert({
          agent_email: userEmail.toLowerCase(),
          changelog_entry_id: entryId,
          viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'agent_email,changelog_entry_id'
        });

      if (error) {
        console.error('Failed to mark changelog as viewed:', error);
        // Revert state on error
        setViewedEntryIds(prev => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
      } else {
        // Force immediate refetch to sync with database
        const result = await refetchViews();
        // Update state immediately from refetch result
        if (result.data) {
          const viewed = new Set(
            result.data
              .filter((v: any) => v.dismissed || v.viewed_at)
              .map((v: any) => v.changelog_entry_id)
          );
          setViewedEntryIds(viewed);
        }
        // Also invalidate entries query to ensure UI updates
        queryClient.invalidateQueries({ queryKey: ['changelog-entries'] });
      }
    } catch (error) {
      console.error('Error marking changelog as viewed:', error);
      // Revert state on error
      setViewedEntryIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  // Dismiss entry
  const dismissEntry = async (entryId: string) => {
    if (!supabase || !userEmail) return;

    try {
      // IMMEDIATELY update local state first for instant UI feedback
      setViewedEntryIds(prev => new Set(prev).add(entryId));
      
      // Mark as both viewed and dismissed to ensure it's properly tracked
      const { error } = await supabase
        .from('changelog_views')
        .upsert({
          agent_email: userEmail.toLowerCase(),
          changelog_entry_id: entryId,
          viewed_at: new Date().toISOString(), // Also mark as viewed
          dismissed: true,
          dismissed_at: new Date().toISOString(),
        }, {
          onConflict: 'agent_email,changelog_entry_id'
        });

      if (error) {
        console.error('Failed to dismiss changelog entry:', error);
        // Revert state on error
        setViewedEntryIds(prev => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
      } else {
        // Force immediate refetch to sync with database
        const result = await refetchViews();
        // Update state immediately from refetch result
        if (result.data) {
          const viewed = new Set(
            result.data
              .filter((v: any) => v.dismissed || v.viewed_at)
              .map((v: any) => v.changelog_entry_id)
          );
          setViewedEntryIds(viewed);
        }
        // Also invalidate entries query to ensure UI updates
        queryClient.invalidateQueries({ queryKey: ['changelog-entries'] });
      }
    } catch (error) {
      console.error('Error dismissing changelog entry:', error);
      // Revert state on error
      setViewedEntryIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  // Filter out viewed/dismissed entries - use useMemo to ensure it recalculates when viewedEntryIds changes
  const unreadEntries = useMemo(() => {
    return entries.filter(entry => !viewedEntryIds.has(entry.id));
  }, [entries, viewedEntryIds]);

  return {
    entries,
    unreadEntries,
    isLoading,
    markAsViewed,
    dismissEntry,
  };
}

