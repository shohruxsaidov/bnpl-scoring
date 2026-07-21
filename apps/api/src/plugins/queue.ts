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
import {
  KATM_CLAIM_REJECT_QUEUE,
  processClaimRejectJob,
  type ClaimRejectJobData,
} from '../modules/integrations/katm/claim-reject';
import {
  DEAL_SESSION_SWEEP_QUEUE,
  DEAL_SESSION_SWEEP_INTERVAL_MS,
  processDealSessionSweepJob,
} from '../modules/merchant/deal-sessions/sweep';
import {
  NOTIFICATIONS_PUSH_QUEUE,
  processNotificationPushJob,
  setNotificationsPushQueue,
  type NotificationPushJobData,
} from '../modules/client/notifications/push';
import {
  PAYME_SWEEP_QUEUE,
  PAYME_SWEEP_INTERVAL_MS,
  PAYME_SWEEP_JOB_ID,
  processPaymeSweepJob,
} from '../modules/integrations/payme/sweep';
import {
  PLUM_CARD_SCORE_QUEUE,
  handlePlumCardScoreFailure,
  processPlumCardScoreJob,
  setPlumCardScoreQueue,
  type PlumCardScoreJobData,
} from '../modules/integrations/plumgate/card-scoring';

declare module 'fastify' {
  interface FastifyInstance {
    katmPollQueue: Queue<KatmPollJobData>;
    katmClaimRejectQueue: Queue<ClaimRejectJobData>;
    dealSessionSweepQueue: Queue;
    paymeSweepQueue: Queue;
    notificationsPushQueue: Queue<NotificationPushJobData>;
    plumCardScoreQueue: Queue<PlumCardScoreJobData>;
    // Every Queue created by this plugin, in registration order. The bull-board
    // dashboard iterates this so new queues surface without touching its plugin.
    queues: Queue[];
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
  const claimRejectQueue: Queue<ClaimRejectJobData> = new Queue(KATM_CLAIM_REJECT_QUEUE, {
    connection,
  });
  const sweepQueue: Queue = new Queue(DEAL_SESSION_SWEEP_QUEUE, { connection });
  const notificationsPushQueue: Queue<NotificationPushJobData> = new Queue(
    NOTIFICATIONS_PUSH_QUEUE,
    { connection },
  );
  // Hand the producing queue to notify() so it can enqueue without threading the
  // queue through every scoring/finalize call site.
  setNotificationsPushQueue(notificationsPushQueue);

  const plumCardScoreQueue: Queue<PlumCardScoreJobData> = new Queue(PLUM_CARD_SCORE_QUEUE, {
    connection,
  });
  setPlumCardScoreQueue(plumCardScoreQueue);

  // Payme pending-transaction timeout. A repeatable job with a fixed jobId, so
  // every boot upserts the same schedule instead of stacking another one.
  const paymeSweepQueue: Queue = new Queue(PAYME_SWEEP_QUEUE, { connection });
  await paymeSweepQueue.add(
    'sweep',
    {},
    {
      jobId: PAYME_SWEEP_JOB_ID,
      repeat: { every: PAYME_SWEEP_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Registry consumed by the bull-board dashboard. Push each new queue here.
  const queues: Queue[] = [
    queue,
    claimRejectQueue,
    sweepQueue,
    notificationsPushQueue,
    plumCardScoreQueue,
    paymeSweepQueue,
  ];

  const worker = new Worker<KatmPollJobData>(
    KATM_POLL_QUEUE,
    async (job) => processKatmPollJob(job.data, queue, claimRejectQueue),
    { connection, concurrency: 5, maxStalledCount: 3 },
  );

  // Claim retraction — its own worker with a short fixed backoff (see
  // claim-reject.ts). No scoring-failure finalizer: a failed retraction is
  // logged and left in the queue (removeOnFail:false) for manual re-drive.
  const claimRejectWorker = new Worker<ClaimRejectJobData>(
    KATM_CLAIM_REJECT_QUEUE,
    async (job) => processClaimRejectJob(job.data),
    { connection, concurrency: 5 },
  );

  claimRejectWorker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    app.log.warn(
      { jobId: job.id, claimId: job.data.claimId, err, exhausted },
      exhausted ? 'katm claim reject exhausted — claim left as created' : 'katm claim reject attempt failed',
    );
  });

  // Notification push — best-effort FCM delivery mirroring an inbox row. Retries
  // on transient/whole-job failure; the inbox row is the durable record.
  const notificationsPushWorker = new Worker<NotificationPushJobData>(
    NOTIFICATIONS_PUSH_QUEUE,
    async (job) => processNotificationPushJob(job.data, app.log),
    { connection, concurrency: 5 },
  );

  notificationsPushWorker.on('failed', (job, err) => {
    if (!job) return;
    app.log.warn(
      { jobId: job.id, notificationId: job.data.notificationId, err },
      'notification push attempt failed',
    );
  });

  // plum_card — observational card-behaviour scoring. Uzcard polls (throw/retry),
  // Humo answers inline. Nothing here may touch the scoring run: an exhausted job
  // marks its own row 'error' and the run stays exactly as the model left it.
  const plumCardScoreWorker = new Worker<PlumCardScoreJobData>(
    PLUM_CARD_SCORE_QUEUE,
    async (job) => processPlumCardScoreJob(job.data),
    { connection, concurrency: 5 },
  );

  plumCardScoreWorker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    // A pending poll is the normal path, not a fault — only log it once it dies.
    if (err.name !== 'PlumScorePendingError' || exhausted) {
      app.log.warn(
        { jobId: job.id, scoringId: job.data.scoringId, err, exhausted },
        'plum card score attempt failed',
      );
    }
    if (exhausted) {
      handlePlumCardScoreFailure(job.data, err).catch((e) =>
        app.log.error({ err: e }, 'plum card score failure finalizer crashed'),
      );
    }
  });

  // Payme timeout sweep. Frees deals whose payer abandoned checkout — without
  // it, one dead pending transaction blocks the deal's one-pending slot forever,
  // because an abandoned transaction never receives the call that would expire
  // it lazily.
  const paymeSweepWorker = new Worker(
    PAYME_SWEEP_QUEUE,
    async () => {
      const expired = await processPaymeSweepJob();
      if (expired > 0) app.log.info({ expired }, 'payme pending transactions expired');
      return expired;
    },
    { connection, concurrency: 1 },
  );

  paymeSweepWorker.on('failed', (job, err) => {
    app.log.warn({ jobId: job?.id, err }, 'payme transaction sweep failed');
  });

  worker.on('failed', (job, err) => {
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
  app.decorate('katmClaimRejectQueue', claimRejectQueue);
  app.decorate('notificationsPushQueue', notificationsPushQueue);
  app.decorate('plumCardScoreQueue', plumCardScoreQueue);
  app.decorate('paymeSweepQueue', paymeSweepQueue);
  app.decorate('queues', queues);
  app.addHook('onClose', async () => {
    await worker.close();
    await claimRejectWorker.close();
    await notificationsPushWorker.close();
    await plumCardScoreWorker.close();
    await paymeSweepWorker.close();
    await queue.close();
    await claimRejectQueue.close();
    await notificationsPushQueue.close();
    await plumCardScoreQueue.close();
    await paymeSweepQueue.close();
    await redis.quit().catch(() => null);
  });
});
