import { z } from "zod";

export const TELEMETRY_SCHEMA_VERSION = 1;

const EVENT_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const paramsSchema = z.object({
  actorId: z.string().min(1, "actorId is required"),
  eventName: z
    .string()
    .regex(EVENT_NAME, "eventName must be snake_case, optionally dot-namespaced (e.g. checkout.completed)"),
  properties: z.record(z.string(), z.unknown()).default({}),
  userTraits: z.record(z.string(), z.unknown()).default({}),
});

export type TelemetryParams = {
  actorId: string;
  eventName: string;
  properties?: Record<string, unknown>;
  userTraits?: Record<string, unknown>;
};

export interface TelemetryEvent {
  eventId: string;
  schemaVersion: number;
  timestamp: string;
  actorId: string;
  eventName: string;
  properties: Record<string, unknown>;
  userTraits: Record<string, unknown>;
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Validate and format the standard `(actorId, eventName, properties, userTraits)` tuple. Throws on invalid input. */
export function trackTelemetryEvent(params: TelemetryParams): TelemetryEvent {
  const parsed = paramsSchema.parse(params);
  return {
    eventId: newId(),
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    ...parsed,
  };
}

/** Pluggable persistence for the offline queue (AsyncStorage, localStorage, file, ...). */
export interface TelemetryStorage {
  load(): Promise<TelemetryEvent[]>;
  save(events: TelemetryEvent[]): Promise<void>;
}

export interface TelemetryQueueOptions {
  /** Deliver a batch. Throw/reject to signal failure (events are kept for retry). */
  send: (batch: TelemetryEvent[]) => Promise<void>;
  storage?: TelemetryStorage;
  /** Max events kept; oldest are dropped first (default 500). */
  maxSize?: number;
  /** Events per request (default 20). */
  batchSize?: number;
}

export interface TelemetryQueue {
  enqueue(params: TelemetryParams): Promise<TelemetryEvent | null>;
  /** Try to deliver everything queued. Returns the number of events delivered. */
  flush(): Promise<number>;
  size(): number;
}

/** Offline-first queue: events are stored first, delivered in batches, retained on failure. */
export function createTelemetryQueue(options: TelemetryQueueOptions): TelemetryQueue {
  const maxSize = options.maxSize ?? 500;
  const batchSize = options.batchSize ?? 20;
  let events: TelemetryEvent[] = [];
  let loaded = false;
  let flushing: Promise<number> | null = null;

  const persist = async () => {
    try {
      await options.storage?.save(events);
    } catch {
      /* telemetry must never throw into app code */
    }
  };
  const ensureLoaded = async () => {
    if (loaded) return;
    loaded = true;
    try {
      events = (await options.storage?.load()) ?? [];
    } catch {
      events = [];
    }
  };

  return {
    async enqueue(params) {
      await ensureLoaded();
      let event: TelemetryEvent;
      try {
        event = trackTelemetryEvent(params);
      } catch {
        return null;
      }
      events.push(event);
      if (events.length > maxSize) events = events.slice(events.length - maxSize);
      await persist();
      return event;
    },
    flush() {
      flushing ??= (async () => {
        await ensureLoaded();
        let delivered = 0;
        try {
          while (events.length > 0) {
            const batch = events.slice(0, batchSize);
            await options.send(batch);
            events = events.slice(batch.length);
            delivered += batch.length;
            await persist();
          }
        } catch {
          /* offline or server error: keep remaining events for the next flush */
        }
        return delivered;
      })().finally(() => {
        flushing = null;
      });
      return flushing;
    },
    size: () => events.length,
  };
}
