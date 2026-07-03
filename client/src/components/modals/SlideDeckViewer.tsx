import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface Screenshot {
  id: string;
  screenshot_url: string;
  screenshot_data: string;
  captured_at: string;
  sequence_number: number;
}

interface SlideDeckViewerProps {
  isOpen: boolean;
  onClose: () => void;
  screenshots: Screenshot[];
  sessionId: string;
  agentName: string;
}

export function SlideDeckViewer({
  isOpen,
  onClose,
  screenshots,
  sessionId,
  agentName
}: SlideDeckViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [zoom, setZoom] = useState(100);

  const sortedScreenshots = [...screenshots].sort((a, b) => a.sequence_number - b.sequence_number);

  const goToNext = () => {
    if (currentSlide < sortedScreenshots.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToPrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'Escape') onClose();
  };

  const downloadScreenshot = () => {
    const screenshot = sortedScreenshots[currentSlide];
    if (!screenshot) return;

    const link = document.createElement('a');
    link.href = screenshot.screenshot_data || screenshot.screenshot_url;
    link.download = `screenshot-${screenshot.sequence_number}.png`;
    link.click();
  };

  const zoomIn = () => setZoom(Math.min(zoom + 25, 200));
  const zoomOut = () => setZoom(Math.max(zoom - 25, 50));

  if (sortedScreenshots.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>No Screenshots Available</DialogTitle>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110 bg-white dark:bg-gray-900"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </DialogHeader>
          <p className="text-gray-600">This presentation has no screenshots yet.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const currentScreenshot = sortedScreenshots[currentSlide];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-6xl h-[90vh] p-0 flex flex-col [&>button]:hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Presentation Slide Deck</DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                {agentName} • Slide {currentSlide + 1} of {sortedScreenshots.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                disabled={zoom === 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                disabled={zoom === 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadScreenshot}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110 bg-white dark:bg-gray-900"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Screenshot Display */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
          <div 
            className="relative bg-white shadow-2xl rounded-lg overflow-hidden"
            style={{ 
              width: `${zoom}%`,
              maxWidth: '100%'
            }}
          >
            <img
              src={currentScreenshot.screenshot_data || currentScreenshot.screenshot_url}
              alt={`Screenshot ${currentSlide + 1}`}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="px-6 py-4 border-t bg-white">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goToPrevious}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {/* Thumbnail Preview */}
            <div className="flex gap-2 overflow-x-auto max-w-xl">
              {sortedScreenshots.map((screenshot, index) => (
                <button
                  key={screenshot.id}
                  onClick={() => setCurrentSlide(index)}
                  className={`flex-shrink-0 w-16 h-12 border-2 rounded overflow-hidden transition-all ${
                    index === currentSlide
                      ? 'border-blue-500 shadow-lg scale-110'
                      : 'border-gray-300 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={screenshot.screenshot_data || screenshot.screenshot_url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={goToNext}
              disabled={currentSlide === sortedScreenshots.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="text-center mt-3 text-xs text-gray-500">
            Use ← → arrow keys to navigate • ESC to close
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

