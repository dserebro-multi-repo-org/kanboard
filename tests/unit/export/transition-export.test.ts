import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from '../../../src/core/container/container.js';
import { phpDate } from '../../../src/core/php-date.js';
import { TransitionExport } from '../../../src/export/transition-export.js';
import { createTestContainer } from './helpers.js';

let container: Container;
const calls: unknown[][] = [];

beforeEach(async () => {
  const now = Math.floor(Date.now() / 1000);
  container = await createTestContainer({
    transitionModel: {
      getAllByProjectAndDate: (...args: unknown[]) => {
        calls.push(args);
        return [{ id: '1', title: 'test', src_column: 'Backlog', dst_column: 'Ready', name: '', username: 'admin', user_id: 1, date: now, time_spent: 3600 }];
      },
    },
  });
});
afterEach(async () => container.get('db').close());

describe('TransitionExport', () => {
  it('exports the transitions', async () => {
    const today = phpDate('Y-m-d');
    const export_ = await new TransitionExport(container).export(1, today, today);

    expect(calls[0]).toEqual([1, today, today]);
    expect(export_).toHaveLength(2);
    expect(export_[0]).toEqual(['Id', 'Task Title', 'Source column', 'Destination column', 'Executer', 'Date', 'Time spent']);
    expect(export_[1]).toEqual([1, 'test', 'Backlog', 'Ready', 'admin', phpDate('m/d/Y H:i'), 1.0]);
  });
});
