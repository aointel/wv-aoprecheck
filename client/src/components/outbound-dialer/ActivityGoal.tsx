import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityGoalProps {
  className?: string;
}

export function ActivityGoal({ className }: ActivityGoalProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Activity Goal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-muted-foreground">Activity tracking coming soon!</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivityGoal;