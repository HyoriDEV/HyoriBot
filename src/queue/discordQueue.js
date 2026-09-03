import { logger } from '../logger/index.js';
export class DiscordQueue {
  constructor(concurrency = 2) {
    this.queue = [];
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.totalProcessed = 0;
    this.totalFailed = 0;
  }
  async enqueue(name, task, maxRetries = 3) {
    return new Promise((resolve, reject) => {
      const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        task,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        createdAt: Date.now(),
      };
      this.queue.push(job);
      logger.debug(
        {
          jobId: job.id,
          jobName: job.name,
          queueLength: this.queue.length,
        },
        'Job added to Discord queue'
      );
      this.processNext();
    });
  }
  enqueueAsync(name, task, maxRetries = 3) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      id: jobId,
      name,
      task,
      resolve: () => {
        logger.debug(
          {
            jobId,
            name,
          },
          'Async background Discord job succeeded'
        );
      },
      reject: err => {
        logger.error(
          {
            jobId,
            name,
            error: err,
          },
          'Async background Discord job failed completely'
        );
      },
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
    };
    this.queue.push(job);
    logger.debug(
      {
        jobId,
        name,
        queueLength: this.queue.length,
      },
      'Async background job enqueued'
    );
    this.processNext();
    return jobId;
  }
  async processNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }
    const job = this.queue.shift();
    if (!job) return;
    this.activeWorkers++;
    try {
      logger.debug(
        {
          jobId: job.id,
          jobName: job.name,
          attempt: job.retries + 1,
        },
        'Executing Discord task from queue'
      );
      const result = await job.task();
      this.totalProcessed++;
      job.resolve(result);
    } catch (error) {
      const isRateLimit =
        error?.status === 429 || error?.code === 429 || error?.message?.includes('429');
      const retryAfter = error?.retryAfter || error?.rawError?.retry_after || 1000;
      if (job.retries < job.maxRetries) {
        job.retries++;
        const backoffMs = isRateLimit ? retryAfter * 1000 + 200 : Math.pow(2, job.retries) * 500;
        logger.warn(
          {
            jobId: job.id,
            jobName: job.name,
            retries: job.retries,
            backoffMs,
            isRateLimit,
            error: error?.message || error,
          },
          'Discord task failed with recoverable error, retrying after backoff'
        );
        setTimeout(() => {
          this.queue.unshift(job);
          this.processNext();
        }, backoffMs);
      } else {
        this.totalFailed++;
        logger.error(
          {
            jobId: job.id,
            jobName: job.name,
            error: error?.message || error,
            retries: job.retries,
          },
          'Discord task exceeded max retries, failing permanently'
        );
        job.reject(error);
      }
    } finally {
      this.activeWorkers--;
      setImmediate(() => this.processNext());
    }
  }
  getStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
    };
  }
}
export const discordQueue = new DiscordQueue(3);
