declare module './twilio-auto-sync.js' {
  export class TwilioAutoSync {
    startAutoSync(intervalMs?: number): void;
    stopAutoSync(): void;
    start(): void;
    stop(): void;
    runOnce(): Promise<void>;
    fixExistingAttributions(): Promise<number>;
    getStatus(): {
      running: boolean;
      lastRunAt: string | null;
      lastError: string | null;
    };
  }

  export const twilioAutoSync: TwilioAutoSync;
}

