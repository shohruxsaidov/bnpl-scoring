import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../env';
import {
  KATM_POLL_QUEUE,
  handleKatmPollFailure,
  processKatmPollJob,
  type KatmPollJobData,
} from '../modules/integrations/katm/poller';

declare module 'fastify' {
  interface FastifyInstance {
    katmPollQueue: Queue<KatmPollJobData>;
  }
}

/**
 * BullMQ background jobs (Redis-backed) — ADR-0001 (amended), ADR-0025.
 * Currently one queue: KATM report polling. The worker runs in-process;
 * jobs survive restarts in Redis.
 */
export default fp(async function queuePlugin(app: FastifyInstance) {
  // BullMQ requires its own connection with maxRetriesPerRequest: null —
  // the shared app.redis client is tuned for fail-fast request handling.
  // The cast bridges BullMQ's bundled ioredis typings vs our ioredis version.
  const redis = new Redis(env.REDIS_URL, { family: 4, maxRetriesPerRequest: null });
  redis.on('error', (err) => app.log.warn({ err }, 'BullMQ Redis error'));
  const connection = redis as unknown as ConnectionOptions;

  const queue: Queue<KatmPollJobData> = new Queue(KATM_POLL_QUEUE, { connection });

  const worker = new Worker<KatmPollJobData>(
    KATM_POLL_QUEUE,
    async (job) => processKatmPollJob(job.data, queue),
    { connection, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.log(job);
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (err.name !== 'KatmReportPendingError' || exhausted) {
      app.log.warn({ jobId: job.id, data: job.data, err, exhausted }, 'katm poll attempt failed');
    }
    if (exhausted) {
      handleKatmPollFailure(job.data, err).catch((e) =>
        app.log.error({ err: e }, 'katm poll failure finalizer crashed'),
      );
    }
  });

  app.decorate('katmPollQueue', queue);
  app.addHook('onClose', async () => {
    await worker.close();
    await queue.close();
    await redis.quit().catch(() => null);
  });
});
