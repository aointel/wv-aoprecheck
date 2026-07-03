/**
 * Minimal shell SPA for compartmentalized architecture.
 * Sidebar + links to section origins (Connect, Precheck, Precheck Admin, Recruit, Stats).
 * Does not bundle full section UIs; navigates to section URLs.
 */
import React from "react";

const env = import.meta.env;
const getSectionUrl = (key: string, path: string): string => {
  const base = (env as Record<string, string>)[`VITE_SECTION_${key.toUpperCase().replace(/-/g, "_")}_URL`];
  if (base) return base.replace(/\/$/, "");
  return path;
};

const sections = [
  { path: "/dashboard/connect", label: "Call Connector Pro", key: "connect" },
  { path: "/dashboard/verification-start", label: "AO Precheck", key: "precheck" },
  { path: "/dashboard/aoi-precheck-admin", label: "Precheck Management", key: "precheck-admin" },
  { path: "/dashboard/ao-recruit", label: "AO Recruit", key: "recruit" },
  { path: "/dashboard/live-call-board", label: "Live Call Board / Stats", key: "stats" },
  { path: "/conference-test", label: "⚡ Conf Test", key: "connect" },
];

export function ShellApp() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside
        style={{
          width: 240,
          background: "#1a1a2e",
          color: "#eee",
          padding: "1.5rem 0",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 1rem 1rem", borderBottom: "1px solid #333", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>AO Intelligence</h1>
        </div>
        <nav>
          {sections.map(({ path, label, key }) => {
            const href = getSectionUrl(key, path);
            return (
              <a
                key={key}
                href={href}
                style={{
                  display: "block",
                  padding: "0.6rem 1rem",
                  color: "#ccc",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#252538";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#ccc";
                }}
              >
                {label}
              </a>
            );
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: "2rem", background: "#f5f5f5" }}>
        <h2 style={{ marginTop: 0, color: "#333" }}>Dashboard</h2>
        <p style={{ color: "#666" }}>
          Choose a section from the sidebar to open Call Connector Pro, Precheck, Recruit, or Stats.
        </p>
      </main>
    </div>
  );
}

