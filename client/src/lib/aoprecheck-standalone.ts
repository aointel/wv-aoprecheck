/** True on the dedicated aoprecheck service (not Connect monolith precheck routes). */
export function isAoPrecheckStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("standalone") === "1") return true;
  const host = window.location.hostname.toLowerCase();
  if (host.includes("aoprecheck")) return true;
  if (window.self !== window.top && window.location.pathname.includes("verification-start")) return true;
  return false;
}

export function precheckGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
