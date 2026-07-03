import React from "react";

/** Minimal chrome for aoprecheck — no Connect sidebar or HeaderToolbar. */
export function PrecheckStandaloneLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f6f7f9] text-[#0f1729]">{children}</div>;
}
