import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HeroSlide } from './dashboardConfig';

const AUTOPLAY_MS = 7000;
const GRADIENTS: Record<string, string> = {
  'gradient-blue': 'from-blue-600 via-indigo-600 to-blue-700',
  'gradient-amber': 'from-amber-500 via-orange-500 to-amber-600',
  'gradient-purple': 'from-purple-600 via-fuchsia-600 to-purple-700',
  'gradient-orange': 'from-orange-500 via-amber-500 to-orange-600',
  'gradient-sky': 'from-sky-500 via-blue-500 to-sky-600',
};

interface HeroCarouselProps {
  slides: HeroSlide[];
}

export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [, setLocation] = useLocation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = slides.length;
  const slide = count > 0 ? slides[index % count] : null;
  const gradientClass = slide
    ? GRADIENTS[slide.imageKey] || GRADIENTS['gradient-blue']
    : '';

  const goTo = useCallback(
    (i: number) => {
      setIndex((count > 0 ? ((i % count) + count) % count : 0));
    },
    [count]
  );

  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused, index, next]);

  const handleSlideClick = () => {
    if (slide?.href) setLocation(slide.href);
  };

  if (count === 0) return null;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Hero carousel"
    >
      <button
        type="button"
        onClick={handleSlideClick}
        className={cn(
          'w-full text-left block transition-opacity hover:opacity-95',
          'bg-gradient-to-r',
          gradientClass
        )}
        aria-label={slide ? `Go to ${slide.title}` : undefined}
      >
        <div className="px-6 py-8 sm:px-8 sm:py-10 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-1">{slide?.title}</h2>
          <p className="text-white/90 text-sm sm:text-base mb-4">
            {slide?.subtitle}
          </p>
          <span className="inline-flex items-center rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium">
            Open
          </span>
        </div>
      </button>

      {count > 1 && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div
            className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5"
            role="tablist"
            aria-label="Slide dots"
          >
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
