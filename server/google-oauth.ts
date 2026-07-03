import { google } from "googleapis";

const {
  GOOGLE_CLIENT_ID = "207338471615-skdt0vvt7emcjnobcn2e2o77vur3mc8t.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET = "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",
  GOOGLE_REDIRECT_URI = "https://aoirail-production-baa2.up.railway.app/auth/google/callback",
  GOOGLE_CALENDAR_ENABLED = "true"
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth env missing: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required");
}

console.log(
  "🗓️ Google OAuth →",
  GOOGLE_CLIENT_ID.slice(0, 10), "...", GOOGLE_CLIENT_ID.slice(-10),
  "| redirect:", GOOGLE_REDIRECT_URI,
  "| enabled:", GOOGLE_CALENDAR_ENABLED
);

export const oauth2 = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

export const calendar = () => google.calendar({ version: "v3", auth: oauth2 });

export const isGoogleCalendarEnabled = () => GOOGLE_CALENDAR_ENABLED === "true";
