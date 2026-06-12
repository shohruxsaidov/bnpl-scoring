import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { env } from '../env'
import {
  KATM_POLL_QUEUE,
  handleKatmPollFailure,
  processKatmPollJob,
  type KatmPollJobData,
} from '../modules/integrations/katm/poller'

declare module 'fastify' {
  interface FastifyInstance {
    katmPollQueue: Queue<KatmPollJobData>
  }
}

/**
 * BullMQ background jobs (Redis-backed) — ADR-0001 (amended), ADR-0025.
 * Currently one queue: KATM report polling. The worker runs in-process;
 * jobs survive restarts in Redis.
 */
export default fp(async function queuePlugin(app: FastifyInstance) {
  // BullMQ requires its own connection with maxRetriesPerRequest: null —
  // the shared app.redis client is tuned for fail-fast request handling
  const connection = new Redis(env.REDIS_URL, { family: 4, maxRetriesPerRequest: null })
  connection.on('error', (err) => app.log.warn({ err }, 'BullMQ Redis error'))

  const queue = new Queue<KatmPollJobData>(KATM_POLL_QUEUE, { connection })

  const worker = new Worker<KatmPollJobData>(
    KATM_POLL_QUEUE,
    async (job) => processKatmPollJob(app.db, job.data),
    { connection, concurrency: 5 },
  )

  worker.on('failed', (job, err) => {
    if (!job) return
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1)
    if (err.name !== 'KatmReportPendingError' || exhausted) {
      app.log.warn({ jobId: job.id, data: job.data, err, exhausted }, 'katm poll attempt failed')
    }
    if (exhausted) {
      handleKatmPollFailure(app.db, job.data, err).catch((e) =>
        app.log.error({ err: e }, 'katm poll failure finalizer crashed'),
      )
    }
  })

  app.decorate('katmPollQueue', queue)
  app.addHook('onClose', async () => {
    await worker.close()
    await queue.close()
    await connection.quit().catch(() => null)
  })
})
