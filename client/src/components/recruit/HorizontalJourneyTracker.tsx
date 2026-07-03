import { CheckCircle } from 'lucide-react';

interface HorizontalJourneyTrackerProps {
  videoSection1Watched?: boolean;
  videoSection2Watched?: boolean;
  question1Answered?: boolean;
  question2Answered?: boolean;
  question3Answered?: boolean;
  currentVideoChapter?: number; // 0 = Our Company, 1 = Compensation, 2 = Next Step
  videoProgress?: number; // 0-100 for current chapter
}

export function HorizontalJourneyTracker({
  videoSection1Watched,
  videoSection2Watched,
  question1Answered,
  question2Answered,
  question3Answered,
  currentVideoChapter = 0,
  videoProgress = 0,
}: HorizontalJourneyTrackerProps) {
  // Define steps with proportional widths
  const steps = [
    { name: 'Our Company', width: 60, completed: !!videoSection1Watched, isCurrent: currentVideoChapter === 0 },
    { name: 'Compensation', width: 21, completed: !!videoSection2Watched, isCurrent: currentVideoChapter === 1 },
    { name: 'Next Step', width: 19, completed: !!(videoSection2Watched && question1Answered), isCurrent: currentVideoChapter === 2 },
    { name: 'Questions', width: 15, completed: !!(question1Answered && question2Answered && question3Answered), isCurrent: false },
    { name: 'Ready to Connect', width: 20, completed: !!(question1Answered && question2Answered && question3Answered), isCurrent: false },
  ];

  const allComplete = question1Answered && question2Answered && question3Answered;

  return (
    <div className="space-y-3">
      {/* Horizontal Progress Bar */}
      <div className="flex gap-1">
        {steps.map((step, idx) => {
          // Calculate progress for current step
          let stepProgress = 0;
          if (step.completed) {
            stepProgress = 100;
          } else if (step.isCurrent) {
            stepProgress = videoProgress;
          }

          return (
            <div 
              key={idx} 
              className="relative bg-gray-200 rounded-lg overflow-hidden transition-all duration-300"
              style={{ 
                width: `${step.width}%`,
                height: '48px'
              }}
            >
              {/* Progress Fill */}
              <div 
                className={`absolute inset-0 transition-all duration-500 ${
                  allComplete && idx === steps.length - 1
                    ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 animate-pulse'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400'
                }`}
                style={{ 
                  width: `${stepProgress}%`,
                  opacity: stepProgress > 0 ? 1 : 0
                }}
              />
              
              {/* Step Name */}
              <div className="absolute inset-0 flex items-center justify-center px-1">
                <p className={`text-xs font-medium text-center transition-colors leading-tight ${
                  stepProgress > 50 ? 'text-white' : 'text-gray-600'
                }`} style={{ wordBreak: 'break-word' }}>
                  {step.name}
                </p>
              </div>
              
              {/* Current Indicator Ring */}
              {step.isCurrent && stepProgress < 100 && (
                <div className="absolute inset-0 border-2 border-blue-500 rounded-lg animate-pulse" />
              )}

              {/* Completed Checkmark */}
              {step.completed && (
                <div className="absolute top-1 right-1">
                  <CheckCircle className="h-4 w-4 text-white drop-shadow-lg" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Celebration Message when complete */}
      {allComplete && (
        <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl">
          <p className="text-sm text-green-700 font-bold flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 animate-bounce" />
            Candidate is ready for video interview!
          </p>
        </div>
      )}

      {/* Progress Text */}
      <p className="text-xs text-center text-gray-600">
        {allComplete 
          ? 'Journey complete - Ready to connect' 
          : steps.find(s => s.isCurrent)?.name || 'In progress'}
      </p>
    </div>
  );
}

