'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, Phone, Users, ShieldCheck, Calendar, GraduationCap, HelpCircle, DollarSign, Brain } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { searchGlobalSearchIndex, getSectionLabel, type SearchItem } from '@/lib/global-search-index';
import { cn } from '@/lib/utils';

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  connect: Phone,
  recruit: Users,
  precheck: ShieldCheck,
  meet: Calendar,
  training: GraduationCap,
  gethelp: HelpCircle,
  intelligence: Brain,
  billing: DollarSign,
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const updateResults = useCallback(() => {
    const items = searchGlobalSearchIndex(query);
    setResults(items);
    setOpen(items.length > 0 || query.trim().length >= 2);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(updateResults, 150);
    return () => clearTimeout(timer);
  }, [updateResults]);

  const handleSelect = (item: SearchItem) => {
    setLocation(item.path);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative hidden sm:block w-48 lg:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search connect, recruit, precheck..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && updateResults()}
            onKeyDown={handleKeyDown}
            className="pl-9 h-9 bg-muted/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-48 lg:w-64 p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[320px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query.trim().length < 2
                ? 'Type 2+ characters to search'
                : 'No results found'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {results.map((item) => {
                const Icon = SECTION_ICONS[item.section] || Search;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-sm',
                      'hover:bg-accent hover:text-accent-foreground',
                      'transition-colors cursor-pointer'
                    )}
                  >
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{item.title}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.description}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {getSectionLabel(item.section)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
