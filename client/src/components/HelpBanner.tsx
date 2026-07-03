import React from 'react';

/**
 * Global office hours banner.
 */
export function HelpBanner() {
  return (
    <div className="flex-1 flex justify-center mx-4">
      <div className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 px-4 py-2 shadow-md border border-white/10">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent whitespace-nowrap">
            Office Hours: Tue 10:00 AM & Fri 11:00 AM PST on Zoom @ 5692241629
          </span>
          <span className="text-xs font-semibold text-yellow-100 whitespace-nowrap">
            Speical annoucnent! AOI Globe calls are now $1.00 until End of the month! Load some creedits take some inbounds!
          </span>
        </div>
      </div>
    </div>
  );
}
