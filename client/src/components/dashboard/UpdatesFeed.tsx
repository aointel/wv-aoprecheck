import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UpdateItem } from './dashboardConfig';
import { cn } from '@/lib/utils';

interface UpdatesFeedProps {
  items: UpdateItem[];
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function UpdatesFeed({ items }: UpdatesFeedProps) {
  const [selected, setSelected] = useState<UpdateItem | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Updates">
      <h2 className="text-lg font-semibold text-foreground">Updates</h2>
      <ul className="space-y-2" role="list">
        {items.map((item) => (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href}>
                <a
                  className={cn(
                    'flex flex-wrap items-baseline gap-2 py-2 px-3 rounded-md',
                    'hover:bg-muted transition-colors text-sm'
                  )}
                  aria-label={`Update: ${item.title}`}
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatDate(item.date)}
                  </span>
                  <span className="font-medium">{item.title}</span>
                </a>
              </Link>
            ) : (
              <button
                type="button"
                className={cn(
                  'w-full flex flex-wrap items-baseline gap-2 py-2 px-3 rounded-md text-left',
                  'hover:bg-muted transition-colors text-sm'
                )}
                onClick={() => setSelected(item)}
                aria-label={`View update: ${item.title}`}
              >
                <span className="text-muted-foreground shrink-0">
                  {formatDate(item.date)}
                </span>
                <span className="font-medium">{item.title}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected ? formatDate(selected.date) : ''}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <p className="text-sm text-muted-foreground">{selected.title}</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
