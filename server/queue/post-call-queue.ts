/**
 * Post-call write queue — decouples Twilio webhook processing from DB writes.
 *
 * Instead of blocking webhook handlers on DB operations, we:
 *   1. Accept the Twilio webhook instantly (204 response)
 *   2. Push the work here as a job
 *   3. A worker drains the queue at a controlled rate
 *
 * This prevents DB connection pile-ups during high call volume.
 *
 * Uses in-memory queue (no Redis required) with concurrency limiting.
 * For Redis-backed queues (BullMQ), set REDIS_URL env var.
 */

export type PostCallJobType =
  | 'update-recording-url'
  | 'update-disposition'
  | 'update-call-log'
  | 'find-child-calls'
  | 'update-agent-metrics';

export interface PostCallJob {
  type: PostCallJobType;
  payload: Record<string, any>;
  attemptsMade?: number;
  createdAt?: number;
}

const MAX_CONCURRENCY = Number(process.env.POST_CALL_QUEUE_CONCURRENCY || 5);
const MAX_QUEUE_SIZE = Number(process.env.POST_CALL_QUEUE_MAX || 2000);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

let activeWorkers = 0;
const queue: PostCallJob[] = [];
const handlers = new Map<PostCallJobType, (payload: Record<string, any>) => Promise<void>>();

let drainScheduled = false;

function scheduleDrain() {
  if (drainScheduled) return;
  drainScheduled = true;
  setImmediate(drain);
}

async function drain() {
  drainScheduled = false;
  while (queue.length > 0 && activeWorkers < MAX_CONCURRENCY) {
    const job = queue.shift()!;
    activeWorkers++;
    runJob(job).finally(() => {
      activeWorkers--;
      scheduleDrain();
    });
  }
}

async function runJob(job: PostCallJob) {
  const handler = handlers.get(job.type);
  if (!handler) {
    console.error(`[POST_CALL_QUEUE] No handler for job type: ${job.type}`);
    return;
  }
  try {
    await handler(job.payload);
  } catch (err: any) {
    const attempts = (job.attemptsMade || 0) + 1;
    if (attempts < MAX_RETRIES) {
      console.warn(`[POST_CALL_QUEUE] Job ${job.type} failed (attempt ${attempts}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms:`, err?.message);
      setTimeout(() => {
        queue.push({ ...job, attemptsMade: attempts });
        scheduleDrain();
      }, RETRY_DELAY_MS * attempts);
    } else {
      console.error(`[POST_CALL_QUEUE] Job ${job.type} failed after ${MAX_RETRIES} attempts — dropping:`, err?.message, job.payload);
    }
  }
}

/**
 * Register a handler for a job type.
 * Call this once at startup for each type you want to process.
 */
export function registerQueueHandler(
  type: PostCallJobType,
  handler: (payload: Record<string, any>) => Promise<void>
) {
  handlers.set(type, handler);
}

/**
 * Enqueue a post-call job. Returns immediately.
 * Safe to call from Twilio webhook handlers.
 */
export function enqueuePostCallJob(type: PostCallJobType, payload: Record<string, any>): boolean {
  if (queue.length >= MAX_QUEUE_SIZE) {
    console.error(`[POST_CALL_QUEUE] Queue full (${MAX_QUEUE_SIZE}) — dropping job: ${type}`);
    return false;
  }
  queue.push({ type, payload, attemptsMade: 0, createdAt: Date.now() });
  scheduleDrain();
  return true;
}

/**
 * Returns current queue health stats for monitoring.
 */
export function getQueueStats() {
  return {
    queued: queue.length,
    active: activeWorkers,
    maxConcurrency: MAX_CONCURRENCY,
    handlerCount: handlers.size,
  };
}
