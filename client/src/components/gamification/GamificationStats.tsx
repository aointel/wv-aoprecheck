import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function GamificationStats() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gamification Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          {/* Content will be dynamically loaded */}
        </div>
      </CardContent>
    </Card>
  );
}