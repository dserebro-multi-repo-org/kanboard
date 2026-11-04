import type { Container, ServiceProvider } from '../core/container/container.js';
import { AverageLeadCycleTimeAnalytic } from './average-lead-cycle-time-analytic.js';
import { AverageTimeSpentColumnAnalytic } from './average-time-spent-column-analytic.js';
import { EstimatedActualColumnAnalytic } from './estimated-actual-column-analytic.js';
import { EstimatedTimeComparisonAnalytic } from './estimated-time-comparison-analytic.js';
import { TaskDistributionAnalytic } from './task-distribution-analytic.js';
import { UserDistributionAnalytic } from './user-distribution-analytic.js';
import './registry.js';

/** Registers the analytics as factories (PHP `ClassProvider`, `Analytic` namespace). */
export class AnalyticServiceProvider implements ServiceProvider {
  register(container: Container): void {
    container.factory('averageLeadCycleTimeAnalytic', (c) => new AverageLeadCycleTimeAnalytic(c));
    container.factory('averageTimeSpentColumnAnalytic', (c) => new AverageTimeSpentColumnAnalytic(c));
    container.factory('estimatedActualColumnAnalytic', (c) => new EstimatedActualColumnAnalytic(c));
    container.factory('estimatedTimeComparisonAnalytic', (c) => new EstimatedTimeComparisonAnalytic(c));
    container.factory('taskDistributionAnalytic', (c) => new TaskDistributionAnalytic(c));
    container.factory('userDistributionAnalytic', (c) => new UserDistributionAnalytic(c));
  }
}
