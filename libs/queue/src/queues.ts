import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// ─── Queue Name Registry ─────────────────────────────────────────────────────

export const Queues = {
  EMAIL_SEND: 'email-send',
  ENRICHMENT: 'enrichment',
  AI_AGENT: 'ai-agent',
  SEQUENCE: 'sequence-scheduler',
} as const;

export type QueueName = (typeof Queues)[keyof typeof Queues];

// ─── Redis Connection Factory ─────────────────────────────────────────────────

let _connection: IORedis | null = null;

/**
 * Returns a singleton ioredis connection for BullMQ.
 * Uses REDIS_URL environment variable or defaults to localhost.
 */
export function getRedisConnection(): IORedis {
  if (_connection) return _connection;

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  _connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // required for BullMQ
    enableReadyCheck: false,
  });

  _connection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return _connection;
}

// ─── Queue Factory ────────────────────────────────────────────────────────────

const queueInstances: Map<string, Queue> = new Map();

/**
 * Creates (or retrieves) a BullMQ Queue for the given name.
 * All queues share the same Redis connection pool.
 */
export function createQueue(name: QueueName): Queue {
  if (queueInstances.has(name)) {
    return queueInstances.get(name)!;
  }

  const queue = new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });

  queueInstances.set(name, queue);
  return queue;
}

// ─── Pre-built Queue Instances (lazy - created on first use) ─────────────────

export const emailQueue = new Proxy({} as Queue, {
  get(_, prop) { return (createQueue(Queues.EMAIL_SEND) as any)[prop]; },
});
export const enrichmentQueue = new Proxy({} as Queue, {
  get(_, prop) { return (createQueue(Queues.ENRICHMENT) as any)[prop]; },
});
export const aiAgentQueue = new Proxy({} as Queue, {
  get(_, prop) { return (createQueue(Queues.AI_AGENT) as any)[prop]; },
});
export const sequenceQueue = new Proxy({} as Queue, {
  get(_, prop) { return (createQueue(Queues.SEQUENCE) as any)[prop]; },
});
