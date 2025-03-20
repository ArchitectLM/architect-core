import type { BulkheadOptions, BulkheadRejectionContext, BulkheadConfigContext } from '@architectlm/extensions';
import { BulkheadExtension } from '@architectlm/extensions';

export type {
  BulkheadOptions,
  BulkheadRejectionContext,
  BulkheadConfigContext
};

// Re-export the extension instance
export const bulkheadExtension = new BulkheadExtension();