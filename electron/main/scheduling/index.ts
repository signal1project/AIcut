export { RateLimitedQueues } from './rateLimitedQueues';
export {
  Scheduler,
  nodeScheduleBackend,
  type SchedulerBackend,
  type ScheduledTask,
  type CancellableJob,
} from './scheduler';

import { RateLimitedQueues } from './rateLimitedQueues';
import { Scheduler } from './scheduler';

let queues: RateLimitedQueues | null = null;
let scheduler: Scheduler | null = null;

export function getRateLimitedQueues(): RateLimitedQueues {
  if (!queues) queues = new RateLimitedQueues();
  return queues;
}

export function getScheduler(): Scheduler {
  if (!scheduler) scheduler = new Scheduler();
  return scheduler;
}
