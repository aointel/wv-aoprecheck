import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

type BugLogEntry = {
  level: "log" | "info" | "warn" | "error" | "debug";
  timestamp: string;
  message: string;
};

function setupBugConsoleCapture() {
  if (typeof window === "undefined") return;
  if ((window as any).__bugConsoleCaptureInstalled) return;

  (window as any).__bugConsoleCaptureInstalled = true;
  (window as any).__bugConsoleBuffer = (window as any).__bugConsoleBuffer || [];

  const maxEntries = 250;
  const pushEntry = (entry: BugLogEntry) => {
    const buffer = ((window as any).__bugConsoleBuffer || []) as BugLogEntry[];
    buffer.push(entry);
    if (buffer.length > maxEntries) {
      buffer.splice(0, buffer.length - maxEntries);
    }
    (window as any).__bugConsoleBuffer = buffer;
  };

  const formatArg = (arg: unknown): string => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
    }
    if (typeof arg === "string") return arg;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  };

  const levels: Array<"log" | "info" | "warn" | "error" | "debug"> = ["log", "info", "warn", "error", "debug"];
  for (const level of levels) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushEntry({
        level,
        timestamp: new Date().toISOString(),
        message: args.map(formatArg).join(" "),
      });
      original(...args);
    };
  }

  window.addEventListener("error", (event) => {
    pushEntry({
      level: "error",
      timestamp: new Date().toISOString(),
      message: `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    pushEntry({
      level: "error",
      timestamp: new Date().toISOString(),
      message: `Unhandled promise rejection: ${formatArg(event.reason)}`,
    });
  });
}

// Keep startup non-destructive. Never clear caches/service workers on boot.
if (typeof window !== 'undefined') {
  setupBugConsoleCapture();
  
  // Add version to window for debugging
  (window as any).__APP_VERSION__ = '1.0.4';
  (window as any).__BUILD_TIME__ = new Date().toISOString();
}

createRoot(document.getElementById("root")!).render(<App />);
