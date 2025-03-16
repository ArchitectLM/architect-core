/**
 * Schema Module Index
 * 
 * This module exports all schema-related functionality, including validation,
 * extensions, and utilities.
 */

// Export validation schemas
export * from './validation';

// Export extension registry and types
export * from './extensions/extension-registry';

// Export domain-specific extensions
export * from './extensions/e-commerce';

// Re-export zod for convenience
export { z } from 'zod'; 