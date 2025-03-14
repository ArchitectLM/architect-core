/**
 * Core type definitions for ArchitectLM
 * 
 * This file re-exports all types from the models directory for backward compatibility.
 * New code should import directly from the models directory.
 */

// Re-export all types from the models directory
export * from './models';

// Import the Plugin type for backward compatibility
import { Plugin } from './dsl/plugin';
export { Plugin };
