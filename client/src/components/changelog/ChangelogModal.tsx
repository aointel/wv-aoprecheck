import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, AlertCircle, CheckCircle, Info, Zap, ArrowRight, Rocket, TrendingUp, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description?: string;
  items: Array<{
    type: 'feature' | 'improvement' | 'bugfix' | 'deprecation' | 'security' | 'info';
    text: string;
  }>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  published_at: string;
}

interface ChangelogModalProps {
  entries: ChangelogEntry[];
  isOpen: boolean;
  onClose: () => void;
  onDismiss: (entryId: string) => void;
}

const getItemIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Sparkles className="w-5 h-5 text-blue-500" />;
    case 'improvement':
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    case 'bugfix':
      return <Shield className="w-5 h-5 text-orange-500" />;
    case 'deprecation':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'security':
      return <Shield className="w-5 h-5 text-red-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-400" />;
    default:
      return <Info className="w-5 h-5 text-gray-500" />;
  }
};

const getItemLabel = (type: string) => {
  switch (type) {
    case 'feature':
      return 'New Feature';
    case 'improvement':
      return 'Improvement';
    case 'bugfix':
      return 'Fixed';
    case 'deprecation':
      return 'Deprecated';
    case 'security':
      return 'Security';
    case 'info':
      return 'Info';
    default:
      return 'Update';
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'critical':
      return <Badge className="bg-red-500 text-white border-0">Critical</Badge>;
    case 'high':
      return <Badge className="bg-orange-500 text-white border-0">High Priority</Badge>;
    case 'normal':
      return <Badge className="bg-blue-500 text-white border-0">Update</Badge>;
    default:
      return <Badge className="bg-gray-500 text-white border-0">Info</Badge>;
  }
};

// Play a short notification chime when modal opens (only when there are entries)
function playChangelogNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    // Second tone for a pleasant two-note chime
    const osc2 = audioContext.createOscillator();
    osc2.connect(gainNode);
    osc2.frequency.value = 1108;
    osc2.type = 'sine';
    osc2.start(audioContext.currentTime + 0.15);
    osc2.stop(audioContext.currentTime + 0.35);
  } catch {
    // Fallback: silent fail if Web Audio not supported
  }
}

export function ChangelogModal({ entries, isOpen, onClose, onDismiss }: ChangelogModalProps) {
  const [dismissedEntries, setDismissedEntries] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Play notification sound when modal opens with entries
  React.useEffect(() => {
    if (isOpen && entries.length > 0) {
      playChangelogNotificationSound();
    }
  }, [isOpen, entries.length]);

  const handleDismiss = async (entryId: string) => {
    const entryIndex = visibleEntries.findIndex(e => e.id === entryId);
    const wasCurrentEntry = entryIndex === currentIndex;
    
    // Update local state for immediate UI feedback
    setDismissedEntries(prev => new Set(prev).add(entryId));
    
    // Dismiss in database
    await onDismiss(entryId);
    
    // Adjust index if needed after dismissal
    // Note: visibleEntries will update automatically when unreadEntries changes
    if (wasCurrentEntry) {
      // If we dismissed the current entry, move to next if available, otherwise previous
      if (hasNext) {
        // Stay on same index (next entry moves up)
      } else if (hasPrevious) {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
    } else if (entryIndex < currentIndex) {
      // If we dismissed an entry before current, adjust index
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  };

  // Use entries directly - they're already filtered (unreadEntries from hook)
  // dismissedEntries is only for UI state during dismissal animation
  const visibleEntries = entries;
  
  // Reset to first entry when modal opens or entries change
  // Also clear dismissedEntries when entries change (they're already filtered)
  React.useEffect(() => {
    if (isOpen && visibleEntries.length > 0) {
      setCurrentIndex(0);
    }
    // Clear dismissedEntries when entries change - they're already filtered by the hook
    setDismissedEntries(new Set());
  }, [isOpen, visibleEntries.length, entries]);
  
  // Ensure index is valid
  React.useEffect(() => {
    if (visibleEntries.length > 0 && currentIndex >= visibleEntries.length) {
      setCurrentIndex(Math.max(0, visibleEntries.length - 1));
    }
  }, [visibleEntries.length, currentIndex]);

  const currentEntry = visibleEntries[currentIndex];
  const hasNext = currentIndex < visibleEntries.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleNext = () => {
    if (hasNext) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (visibleEntries.length === 0 && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden [&>button]:hidden">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 relative">
            <DialogClose asChild>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:text-white transition-all rounded-full p-2.5 hover:bg-white/30 backdrop-blur-sm border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl hover:scale-110"
                aria-label="Close"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">What's New</DialogTitle>
                <DialogDescription className="text-blue-100 mt-1">
                  No new updates at this time. Check back soon!
                </DialogDescription>
              </div>
            </div>
          </div>
          
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">You're all caught up! 🎉</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Check back soon for the latest updates</p>
          </div>

          <div className="p-6 border-t bg-gray-50 dark:bg-gray-900/50">
            <Button 
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0 flex flex-col [&>button]:hidden">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 relative flex-shrink-0">
          <DialogClose asChild>
            <button
              onClick={async () => {
                // Dismiss all entries in parallel for faster updates
                await Promise.all(visibleEntries.map(entry => handleDismiss(entry.id)));
                onClose();
              }}
              className="absolute top-4 right-4 text-white hover:text-white transition-all rounded-full p-2.5 hover:bg-white/30 backdrop-blur-sm border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl hover:scale-110 group"
              aria-label="Close and dismiss all updates"
              title="Close and dismiss all"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </DialogClose>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white">What's New</DialogTitle>
              <DialogDescription className="text-blue-100 mt-1">
                {visibleEntries.length} {visibleEntries.length === 1 ? 'update' : 'updates'} • {currentIndex + 1} of {visibleEntries.length}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Single Entry Display with Navigation */}
        <div className="flex-1 overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 relative">
          {currentEntry && (
            <div
              className={cn(
                'h-full overflow-y-auto p-6',
                'transition-all duration-300 ease-in-out'
              )}
            >
              <div
                className={cn(
                  'rounded-xl border-2 p-5 space-y-4',
                  'bg-white dark:bg-gray-800',
                  currentEntry.priority === 'critical' && 'border-red-400 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30',
                  currentEntry.priority === 'high' && 'border-orange-400 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30',
                  currentEntry.priority === 'normal' && 'border-blue-300 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-950/20 dark:via-gray-800 dark:to-purple-950/20',
                  currentEntry.priority === 'low' && 'border-gray-300 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800'
                )}
              >
                {/* Entry Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{currentEntry.title}</h3>
                      {getPriorityBadge(currentEntry.priority)}
                      <Badge variant="outline" className="text-xs font-mono">
                        v{currentEntry.version}
                      </Badge>
                    </div>
                    {currentEntry.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                        {currentEntry.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={() => handleDismiss(currentEntry.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Items List */}
                {currentEntry.items && currentEntry.items.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {currentEntry.items.map((item, itemIndex) => (
                      <div 
                        key={itemIndex} 
                        className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getItemIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              {getItemLabel(item.type)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(currentEntry.published_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Navigation Arrows */}
          {visibleEntries.length > 1 && (
            <>
              {hasPrevious && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl hover:scale-110 transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label="Previous"
                  title="Previous update"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl hover:scale-110 transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label="Next"
                  title="Next update"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              )}
            </>
          )}
          
          {/* Progress Dots */}
          {visibleEntries.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
              {visibleEntries.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    index === currentIndex
                      ? 'bg-blue-600 w-8'
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  )}
                  aria-label={`Go to update ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {visibleEntries.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className="border-gray-300 dark:border-gray-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
            )}
            {visibleEntries.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={!hasNext}
                className="border-gray-300 dark:border-gray-700"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                // Dismiss all entries in parallel for faster updates
                await Promise.all(visibleEntries.map(entry => handleDismiss(entry.id)));
              }}
              className="border-gray-300 dark:border-gray-700"
            >
              Dismiss All
            </Button>
            <Button 
              onClick={async () => {
                // Dismiss all entries in parallel for faster updates
                await Promise.all(visibleEntries.map(entry => handleDismiss(entry.id)));
                onClose();
              }} 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center gap-2 px-6"
            >
              Got it!
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
