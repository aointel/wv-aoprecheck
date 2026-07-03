/**
 * Inbound call queue for agent-pull model.
 * When an inbound arrives we enqueue it (caller hears hold). When an agent says "ready for next call" we dequeue and connect that caller to them.
 */

export interface QueuedInbound {
  callSid: string;
  from: string;
  to: string;
  conferenceName: string;
  createdAt: Date;
  leadState?: string;
  leadMarket?: string;
}

const queue: QueuedInbound[] = [];

export function enqueue(item: Omit<QueuedInbound, 'createdAt'>): void {
  queue.push({ ...item, createdAt: new Date() });
  console.log(`📞 Inbound queue: enqueued ${item.callSid} (from=${item.from}), size=${queue.length}`);
}

export function dequeue(): QueuedInbound | undefined {
  const item = queue.shift();
  if (item) console.log(`📞 Inbound queue: dequeued ${item.callSid}, size=${queue.length}`);
  return item;
}

export function peek(): QueuedInbound | undefined {
  return queue[0];
}

export function size(): number {
  return queue.length;
}

export function getAll(): QueuedInbound[] {
  return [...queue];
}
