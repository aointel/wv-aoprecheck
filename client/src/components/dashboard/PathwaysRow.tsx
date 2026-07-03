import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Pathway } from './dashboardConfig';
import { cn } from '@/lib/utils';

interface PathwaysRowProps {
  pathways: Pathway[];
}

export function PathwaysRow({ pathways }: PathwaysRowProps) {
  if (pathways.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Pathways">
      <h2 className="text-lg font-semibold text-foreground">Pathways</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pathways.map((pathway) => (
          <Card
            key={pathway.id}
            className="flex flex-col overflow-hidden transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-base">{pathway.title}</h3>
              <p className="text-sm text-muted-foreground">
                {pathway.subtitle}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 pt-0">
              {pathway.steps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pathway.steps.map((step, i) => (
                    <Link key={i} href={step.href}>
                      <a
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
                          'bg-muted/50 hover:bg-muted transition-colors'
                        )}
                        aria-label={`Step: ${step.label}`}
                      >
                        {step.label}
                      </a>
                    </Link>
                  ))}
                </div>
              )}
              <Link href={pathway.href} className="mt-auto">
                <Button
                  size="sm"
                  className="w-full"
                  aria-label={`Start ${pathway.title}`}
                >
                  Start
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
