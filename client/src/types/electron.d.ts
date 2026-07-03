// Electron API Type Definitions

interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  getZoomLevel: () => Promise<{ success: boolean; zoom?: number; error?: string }>;
  setZoomLevel: (level: number) => Promise<{ success: boolean; zoom?: number; error?: string }>;
  zoomIn: () => Promise<{ success: boolean; zoom?: number; error?: string }>;
  zoomOut: () => Promise<{ success: boolean; zoom?: number; error?: string }>;
  resetZoom: () => Promise<{ success: boolean; zoom?: number; error?: string }>;
}

interface CaptureSource {
  id: string;
  name: string;
  thumbnail: string;
}

interface PresentationEventData {
  windowId: number;
  title?: string;
  url?: string;
  isHppro?: boolean;
  userEmail?: string;
}

interface AOICaptureAPI {
  getSources: (types?: string[]) => Promise<CaptureSource[]>;
  isPresentationActive: () => Promise<boolean>;
  getPresentationWindows: () => Promise<any[]>;
  setUserEmail: (email: string) => Promise<boolean>;
  startNativeRecording: (sessionId: string) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
  stopNativeRecording: () => Promise<{ success: boolean; count?: number; directory?: string; error?: string }>;
  readScreenshotFile: (filepath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  onPresentationWindowOpened: (callback: (data: PresentationEventData) => void) => void;
  onPresentationWindowClosed: (callback: (data: PresentationEventData) => void) => void;
  onPresentationIframeDetected: (callback: (data: { url: string }) => void) => void;
  removeListener: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    aoiCapture: AOICaptureAPI;
    isElectron: boolean;
    __bugConsoleBuffer?: Array<{
      level: "log" | "info" | "warn" | "error" | "debug";
      timestamp: string;
      message: string;
    }>;
    __bugConsoleCaptureInstalled?: boolean;
    __APP_VERSION__?: string;
    __BUILD_TIME__?: string;
  }
}

export {};

