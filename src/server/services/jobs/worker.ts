// ==============================================
// Worker Process Entry Point
// ==============================================
// Run with: npm run worker
// Processes background jobs from BullMQ queues.
// Gracefully handles Redis unavailability.

import 'dotenv/config';
import logger from '../../utils/logger';

async function main() {
  logger.info('Starting FlexHunter worker process...');

  // Check if Redis is available
  try {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });

    await new Promise<void>((resolve, reject) => {
      redis.on('connect', () => { resolve(); });
      redis.on('error', (err: any) => { reject(err); });
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });

    redis.disconnect();
    logger.info('Redis available — starting BullMQ workers');

    const { startWorkers, scheduleRecurringJobs } = await import('./jobQueue');
    startWorkers();
    await scheduleRecurringJobs();
    logger.info('Worker process running', { queues: ['research', 'import', 'performance', 'replacement', 'store-analysis'] });

  } catch (err: any) {
    logger.warn('Redis unavailable — worker running in standby mode', { error: err.message });
    logger.info('Jobs will run synchronously in the main server process');

    // Keep process alive for Railway
    setInterval(() => {
      logger.debug('Worker standby heartbeat');
    }, 60_000);
  }
}

main().catch((err) => {
  logger.fatal('Worker startup failed', { error: err.message });
  process.exit(1);
});
