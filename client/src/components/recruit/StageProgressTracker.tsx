import { CheckCircle, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

interface StageProgressTrackerProps {
  currentStageId: number;
  stages: Array<{ id: number; name: string; color?: string }>;
}

export function StageProgressTracker({ currentStageId, stages }: StageProgressTrackerProps) {
  // Calculate progress percentage based on stage position
  const currentStageIndex = stages.findIndex(s => s.id === currentStageId);
  const progressPercent = stages.length > 1 
    ? (currentStageIndex / (stages.length - 1)) * 100 
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
        <span>Pipeline Progress</span>
        <span className="text-purple-600 dark:text-purple-400">
          Stage {currentStageIndex + 1} of {stages.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Stage Labels */}
      <div className="flex justify-between text-[10px] font-medium text-gray-500 dark:text-gray-400">
        {stages.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <div 
              key={stage.id} 
              className={`text-center flex-1 flex flex-col items-center gap-1 ${
                isCompleted 
                  ? 'text-green-700 dark:text-green-400' 
                  : isCurrent 
                    ? 'text-purple-700 dark:text-purple-400 font-bold' 
                    : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {/* Icon */}
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <CheckCircle className="w-4 h-4" />
                </motion.div>
              )}
              {isCurrent && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Circle className="w-4 h-4 fill-current" />
                </motion.div>
              )}
              {isPending && <Circle className="w-4 h-4" />}
              
              {/* Stage Name */}
              <span className="leading-tight">{stage.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

