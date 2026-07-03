/**
 * Twilio TaskRouter Activity SIDs for the AOI Command workspace.
 *
 * These constants map the outbound call lifecycle to TaskRouter activities.
 * AOIrail's WebRTC client should update the worker's activity at each stage
 * so that AOI Command can display real-time outbound status.
 *
 * Workspace SID: WS6a978202496f59f6cd478c1310f5c2eb
 */

// ── Activity SIDs ──

/** Agent clicked dial — call is being initiated (available=false) */
export const ACTIVITY_DIALING = 'WAbec4616ec491b3d3d96c87717d64b71c';

/** Call is ringing on the other end (available=false) */
export const ACTIVITY_RINGING = 'WA965abc2ba4f81befd087c77614f3b714';

/** Live conversation — agent is on a call (available=false) */
export const ACTIVITY_BUSY_ON_CALL = 'WA5306bcbb57fd389e964b4190ceaf71cc';

/** Post-call wrap up — agent is finishing notes/disposition (available=false) */
export const ACTIVITY_WRAP = 'WA7cbb8457461d3e22fd83473d7186a3d5';

/** Idle and available for inbound transfers (available=true) */
export const ACTIVITY_AVAILABLE_INBOUND = 'WAc2513cd4c7ec03511690c328ff2a49cd';

/** Idle but outbound only — not accepting inbound transfers */
export const ACTIVITY_AVAILABLE_OUTBOUND_ONLY = 'WA0b2c7d8e9f1a3b5c6d4e2f7a8b9c0d1e'; // TODO: confirm SID

// ── Outbound Call Lifecycle ──
//
// AOIrail WebRTC client should transition through these activities in order:
//
//   1. Agent clicks Dial    →  updateWorkerActivity(workerSid, ACTIVITY_DIALING)
//   2. Call starts ringing  →  updateWorkerActivity(workerSid, ACTIVITY_RINGING)
//   3. Call connects        →  updateWorkerActivity(workerSid, ACTIVITY_BUSY_ON_CALL)
//   4. Call ends            →  updateWorkerActivity(workerSid, ACTIVITY_WRAP)
//   5. Wrap-up complete     →  updateWorkerActivity(workerSid, ACTIVITY_AVAILABLE_INBOUND)
//
// Example usage in AOIrail:
//
//   import { ACTIVITY_DIALING, ACTIVITY_RINGING, ACTIVITY_BUSY_ON_CALL, ACTIVITY_WRAP, ACTIVITY_AVAILABLE_INBOUND } from './twilio-activities';
//
//   // When initiating a call
//   async function onDialClick(workerSid: string) {
//     await updateWorkerActivity(workerSid, ACTIVITY_DIALING);
//     const call = device.connect({ params: { To: phoneNumber } });
//
//     call.on('ringing', () => {
//       updateWorkerActivity(workerSid, ACTIVITY_RINGING);
//     });
//
//     call.on('accept', () => {
//       updateWorkerActivity(workerSid, ACTIVITY_BUSY_ON_CALL);
//     });
//
//     call.on('disconnect', () => {
//       updateWorkerActivity(workerSid, ACTIVITY_WRAP);
//       // After wrap-up timer or manual "done" click:
//       setTimeout(() => {
//         updateWorkerActivity(workerSid, ACTIVITY_AVAILABLE_INBOUND);
//       }, WRAP_TIMEOUT_MS);
//     });
//   }
//
//   async function updateWorkerActivity(workerSid: string, activitySid: string) {
//     await fetch(`/api/worker/${workerSid}/activity`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ activitySid }),
//     });
//   }

// ── All activities (for reference) ──

export const ACTIVITIES = {
  Dialing:              ACTIVITY_DIALING,
  Ringing:              ACTIVITY_RINGING,
  BusyOnCall:           ACTIVITY_BUSY_ON_CALL,
  Wrap:                 ACTIVITY_WRAP,
  AvailableInbound:     ACTIVITY_AVAILABLE_INBOUND,
} as const;
