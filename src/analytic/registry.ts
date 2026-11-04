import type { AverageLeadCycleTimeAnalytic } from './average-lead-cycle-time-analytic.js';
import type { AverageTimeSpentColumnAnalytic } from './average-time-spent-column-analytic.js';
import type { EstimatedActualColumnAnalytic } from './estimated-actual-column-analytic.js';
import type { EstimatedTimeComparisonAnalytic } from './estimated-time-comparison-analytic.js';
import type { TaskDistributionAnalytic } from './task-distribution-analytic.js';
import type { UserDistributionAnalytic } from './user-distribution-analytic.js';

declare module '../core/container/container.js' {
  interface ServiceRegistry {
    averageLeadCycleTimeAnalytic: AverageLeadCycleTimeAnalytic;
    averageTimeSpentColumnAnalytic: AverageTimeSpentColumnAnalytic;
    estimatedActualColumnAnalytic: EstimatedActualColumnAnalytic;
    estimatedTimeComparisonAnalytic: EstimatedTimeComparisonAnalytic;
    taskDistributionAnalytic: TaskDistributionAnalytic;
    userDistributionAnalytic: UserDistributionAnalytic;
  }
}
