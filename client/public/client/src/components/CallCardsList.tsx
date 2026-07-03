import { useEffect, useRef, useState } from "react";
import CallCard from "./CallCard";
import { Call } from "@shared/schema";
import { Loader2, Phone, FilterX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface CallCardsListProps {
  calls: Call[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  onPlayRecording: (call: Call) => void;
  onViewTranscription: (call: Call) => void;
  onViewScreenshot?: (call: Call) => void;
  error?: string;
}

export default function CallCardsList({
  calls,
  isLoading,
  isFetchingNextPage,
  fetchNextPage,
  hasNextPage,
  onPlayRecording,
  onViewTranscription,
  onViewScreenshot,
  error
}: CallCardsListProps) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const [allCalls, setAllCalls] = useState<Call[]>([]);

  // Update allCalls when props.calls changes
  useEffect(() => {
    setAllCalls(calls);
  }, [calls]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm text-slate-500">Loading call records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription className="flex items-center">
          <span className="font-medium mr-1">Error loading calls:</span> {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (allCalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-500">
        <div className="bg-slate-100 p-4 rounded-full mb-4">
          <Phone className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700 mb-1">No calls found</h3>
        <p className="text-sm text-slate-500 mb-4">No call records match your current filters.</p>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-1 px-3"
          onClick={() => window.location.reload()}
        >
          <FilterX className="h-3.5 w-3.5" />
          <span>Clear filters</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2" id="callCardsList">
      <div className="text-xs text-slate-500 mb-2 px-1">
        Showing {allCalls.length} call{allCalls.length !== 1 ? 's' : ''}
      </div>
      
      {allCalls.map(call => (
        <CallCard
          key={call.id}
          call={call}
          onPlayRecording={onPlayRecording}
          onViewTranscription={onViewTranscription}
          onViewScreenshot={onViewScreenshot}
        />
      ))}
      
      {/* Loading indicator for infinite scroll */}
      <div ref={observerTarget} className="py-4 flex justify-center">
        {isFetchingNextPage ? (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
        ) : hasNextPage ? (
          <Button 
            variant="ghost" 
            size="sm"
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            onClick={() => fetchNextPage()}
          >
            Load more calls
          </Button>
        ) : allCalls.length > 0 ? (
          <span className="text-slate-400 text-xs">End of results</span>
        ) : null}
      </div>
    </div>
  );
}
