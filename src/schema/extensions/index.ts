/**
 * Schema Extensions Index
 * 
 * This file exports all schema extensions and ensures they are registered.
 */

// Export extension registry
export * from './extension-registry';

// Import and re-export extensions
import './e-commerce';

// Export individual extensions for direct use
export { eCommerceExtension } from './e-commerce'; 