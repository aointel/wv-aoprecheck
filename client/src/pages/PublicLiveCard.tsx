import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function PublicLiveCard({ params }: { params?: { token?: string; vanitySlug?: string } }) {
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const pathname = String(location || "").toLowerCase().trim();
  let forcedVanity = "";
  if (pathname === "/lafond") forcedVanity = "lafond";
  else if (pathname === "/aoi" || pathname === "/AOI") forcedVanity = "aoi";
  const identifier = String(forcedVanity || params?.token || params?.vanitySlug || '').trim();
  const src = `/api/public/live-card/${encodeURIComponent(identifier)}/exact-html`;

  useEffect(() => {
    // Reset loading state when identifier changes
    setIsLoading(true);
  }, [identifier]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#081424] relative" style={{ touchAction: 'pan-y' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081424] z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-white/80 text-lg font-medium">Loading activity card...</p>
          </div>
        </div>
      )}
      <iframe
        title="Exact Live Activity Card"
        src={src}
        className="h-full w-full border-0"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}

