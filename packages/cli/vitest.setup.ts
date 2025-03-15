/**
 * Vitest setup file for CLI package
 *
 * This file is executed before running tests and can be used to set up
 * global test environment, mocks, and other test utilities.
 */

import { beforeEach, afterEach, afterAll, vi } from 'vitest';

// Reset all mocks after each test
beforeEach(() => {
  vi.resetAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Track test execution times for regression analysis
const testTimes = new Map<string, number>();

beforeEach(context => {
  const testName = context.task.name;
  const startTime = performance.now();
  // Store the start time in a custom property
  (context.task as any)._startTime = startTime;
});

afterEach(context => {
  const testName = context.task.name;
  const startTime = (context.task as any)._startTime as number;
  if (startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    testTimes.set(testName, duration);

    // Log slow tests (over 100ms)
    if (duration > 100) {
      console.warn(`Slow test: "${testName}" took ${duration.toFixed(2)}ms`);
    }
  }
});

// Report test times at the end of the test run
afterAll(() => {
  console.log('\nTest Execution Times:');
  const sortedTimes = [...testTimes.entries()].sort((a, b) => b[1] - a[1]);

  sortedTimes.slice(0, 10).forEach(([testName, duration]) => {
    console.log(`${testName}: ${duration.toFixed(2)}ms`);
  });

  console.log('\nTotal tests tracked:', testTimes.size);
});
