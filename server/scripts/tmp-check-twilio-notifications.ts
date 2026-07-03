import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const list = await client.notifications.list({ log: "0", limit: 100 } as any);
  const recent = list.slice(0, 30).map((n: any) => ({
    sid: n.sid,
    errorCode: n.errorCode,
    messageDate: n.messageDate ? new Date(n.messageDate).toISOString() : null,
    messageText: n.messageText,
    moreInfo: n.moreInfo,
    requestUrl: n.requestUrl || null,
  }));
  console.log(JSON.stringify({ count: list.length, recent }, null, 2));
}

main().catch((e) => {
  console.error((e as Error)?.message || String(e));
  process.exit(1);
});

