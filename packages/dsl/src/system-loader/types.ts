/**
 * System Loader Types
 * 
 * This module defines the types used by the SystemLoader.
 */

import { ReactiveEventBus } from '@architectlm/core';
import { Component, ComponentRef, ComponentType, SystemDefinition } from '../types.js';

/**
 * Loaded system representation
 */
export interface LoadedSystem {
  /** System name */
  name: string;
  
  /** System description */
  description?: string;
  
  /** Component references by type */
  components: {
    schemas: ComponentRef[];
    commands: ComponentRef[];
    events: ComponentRef[];
    queries: ComponentRef[];
    workflows: ComponentRef[];
  };
  
  /** Map of loaded components by name */
  loadedComponents: Map<string, Component>;
  
  /** Validation status */
  validationStatus: {
    isValid: boolean;
    errors: string[];
    lastValidated: Date;
  };
}

/**
 * System loader options
 */
export interface SystemLoaderOptions {
  /** Whether to use lazy loading (default: true) */
  useLazyLoading?: boolean;
  
  /** Event bus for publishing system events */
  eventBus?: ReactiveEventBus;
  
  /** Cache options */
  cacheOptions?: {
    /** Time to live in milliseconds */
    ttl?: number;
    
    /** Maximum number of entries */
    maxEntries?: number;
    
    /** Whether to use sliding expiration */
    slidingExpiration?: boolean;
  };
  
  /** Components to load on the critical path by type */
  criticalPathComponents?: Partial<Record<ComponentType, string[]>>;
  
  /** Whether to validate systems on load (default: true) */
  validateOnLoad?: boolean;
  
  /** Whether to preload all components in the background (default: false) */
  preloadAllInBackground?: boolean;
} 