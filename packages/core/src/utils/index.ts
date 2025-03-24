/**
 * Utilities Module
 * 
 * This module exports utility functions and common helpers
 * used across the core system.
 */

// Error utilities
export {
  DomainError,
  Result,
  createErrorResult,
  createSuccessResult,
  tryExecute,
  tryExecuteAsync
} from './error-utils';

// Base registry
export { BaseRegistry } from './base-registry'; 