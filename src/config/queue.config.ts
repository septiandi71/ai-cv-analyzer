import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
  evaluationConcurrency:
    parseInt(process.env.QUEUE_EVALUATION_CONCURRENCY || '2', 10),
  evaluationAttempts:
    parseInt(process.env.QUEUE_EVALUATION_ATTEMPTS || '3', 10),
  evaluationBackoffDelay:
    parseInt(process.env.QUEUE_EVALUATION_BACKOFF_DELAY || '5000', 10),
}));
