import { CheckCircle, Circle, Clock } from 'lucide-react';

interface JourneyProgressStep {
  label: string;
  completed: boolean;
  isCurrent: boolean;
}

interface JourneyProgressTrackerProps {
  videoSection1Watched?: boolean;
  videoSection2Watched?: boolean;
  question1Answered?: boolean;
  question2Answered?: boolean;
  question3Answered?: boolean;
  className?: string;
}

export function JourneyProgressTracker({
  videoSection1Watched,
  videoSection2Watched,
  question1Answered,
  question2Answered,
  question3Answered,
  className = ''
}: JourneyProgressTrackerProps) {
  // Define the 5 steps of the journey
  const steps: JourneyProgressStep[] = [
    {
      label: 'Started Journey',
      completed: true, // Always true if they're in the queue
      isCurrent: !videoSection1Watched
    },
    {
      label: 'Our Company',
      completed: !!videoSection1Watched,
      isCurrent: !videoSection1Watched && !videoSection2Watched
    },
    {
      label: 'Compensation',
      completed: !!videoSection2Watched,
      isCurrent: !!videoSection1Watched && !videoSection2Watched
    },
    {
      label: 'What\'s Next',
      completed: !!(videoSection2Watched && question1Answered),
      isCurrent: !!videoSection2Watched && !question1Answered
    },
    {
      label: 'Ready to Connect',
      completed: !!(question1Answered && question2Answered && question3Answered),
      isCurrent: !!(question1Answered && question2Answered && !question3Answered)
    }
  ];

  // Calculate progress percentage
  const completedSteps = steps.filter(s => s.completed).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  // Determine status color
  const getStatusColor = () => {
    if (progressPercent === 100) return 'text-green-600';
    if (progressPercent >= 60) return 'text-blue-600';
    if (progressPercent >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Journey Progress
        </p>
        <span className={`text-xs font-bold ${getStatusColor()}`}>
          {completedSteps}/5
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Progress Steps */}
      <div className="space-y-1 pt-1">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            {step.completed ? (
              <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
            ) : step.isCurrent ? (
              <Clock className="h-3 w-3 text-blue-600 flex-shrink-0 animate-pulse" />
            ) : (
              <Circle className="h-3 w-3 text-gray-400 flex-shrink-0" />
            )}
            <span
              className={`text-[10px] leading-tight ${
                step.completed
                  ? 'text-green-700 dark:text-green-400 font-medium'
                  : step.isCurrent
                  ? 'text-blue-700 dark:text-blue-400 font-semibold'
                  : 'text-gray-500 dark:text-gray-500'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Final Status Message */}
      {progressPercent === 100 && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Candidate is ready for video interview!
          </p>
        </div>
      )}
    </div>
  );
}


