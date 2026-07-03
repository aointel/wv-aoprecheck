import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, CheckCircle } from 'lucide-react';
import { HorizontalJourneyTracker } from './HorizontalJourneyTracker';

interface VirtualOverviewProgressProps {
  agentEmail: string;
}

interface JourneyProgress {
  video_section_1_watched: boolean;
  video_section_2_watched: boolean;
  question_1_answered: boolean;
  question_2_answered: boolean;
  question_3_answered: boolean;
  current_video_chapter?: number;
  video_progress_percent?: number;
}

interface CandidateWithProgress {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  journeyProgress: JourneyProgress;
}

export function VirtualOverviewProgress({ agentEmail }: VirtualOverviewProgressProps) {
  // Fetch candidates in Virtual Overview stage with journey progress
  const { data, isLoading } = useQuery({
    queryKey: ['/api/recruit/virtual-overview-progress', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return { candidates: [] };
      const response = await fetch(`/api/recruit/virtual-overview-progress?email=${encodeURIComponent(agentEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch virtual overview progress');
      return response.json();
    },
    enabled: !!agentEmail,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const candidates: CandidateWithProgress[] = data?.candidates || [];

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-2">Loading Virtual Overview candidates...</p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400" data-testid="text-no-virtual-overview">
        <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No candidates in Virtual Overview</p>
        <p className="text-sm mt-1">Candidates will appear here once moved to Virtual Overview stage</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="container-virtual-overview">
      <div className="grid gap-4">
        {candidates.map((candidate) => {
          const allComplete = candidate.journeyProgress.video_section_1_watched &&
                              candidate.journeyProgress.video_section_2_watched &&
                              candidate.journeyProgress.question_1_answered &&
                              candidate.journeyProgress.question_2_answered &&
                              candidate.journeyProgress.question_3_answered;

          return (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow" data-testid={`card-candidate-${candidate.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {candidate.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-name-${candidate.id}`}>
                        {candidate.first_name} {candidate.last_name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400" data-testid={`text-phone-${candidate.id}`}>
                        {candidate.phone}
                      </p>
                    </div>
                  </div>
                  {allComplete && (
                    <Badge className="bg-green-100 text-green-700 border-green-200" data-testid={`badge-complete-${candidate.id}`}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {/* Horizontal Journey Tracker - matches candidate experience */}
                <HorizontalJourneyTracker
                  videoSection1Watched={candidate.journeyProgress.video_section_1_watched}
                  videoSection2Watched={candidate.journeyProgress.video_section_2_watched}
                  question1Answered={candidate.journeyProgress.question_1_answered}
                  question2Answered={candidate.journeyProgress.question_2_answered}
                  question3Answered={candidate.journeyProgress.question_3_answered}
                  currentVideoChapter={candidate.journeyProgress.current_video_chapter}
                  videoProgress={candidate.journeyProgress.video_progress_percent}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
