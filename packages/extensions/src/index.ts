/**
 * @file Entry point for the @architectlm/extensions package
 * @module @architectlm/extensions
 */

/**
 * Extensions Package
 * 
 * This package provides various extensions for the core resilience patterns.
 */

// Export extension system
export type {
  Extension,
  ExtensionPoint,
  Plugin,
  EventInterceptor,
  ExtensionHookHandler,
  ExtensionEvent
} from './extension-system.js';
export { 
  DefaultExtensionSystem, 
  createExtensionSystem
} from './extension-system.js';

// Export plugin management
export type {
  PluginMetadata,
  PluginRegistry
} from './plugin-management.js';
export {
  PluginManager,
  createPluginManager
} from './plugin-management.js';

// Export external system adapter
export type {
  ExternalSystemAdapter,
  ExternalSystemAdapterConfig,
  MemoryExternalSystemAdapterOptions
} from './external-system-adapter.js';
export {
  ExternalSystemAdapterFactory,
  MemoryExternalSystemAdapter,
  externalSystemAdapterFactory
} from './external-system-adapter.js';

// Export event bus integration
export type {
  EventBus,
  EventBusIntegrationOptions
} from './extensions/event-bus-integration.js';
export {
  EventBusIntegrationExtension,
  createExtendedEventBus
} from './extensions/event-bus-integration.js';

// Export error recovery extension
export type {
  RecoveryStrategy,
  RecoveryResult,
  RecoveryContext,
  FallbackHandler
} from './extensions/error-recovery.js';
export { ErrorRecoveryExtension } from './extensions/error-recovery.js';

// Export error classification extension
export type {
  ErrorClassification,
  ErrorClassifier
} from './extensions/error-classification.js';
export { ErrorClassificationExtension } from './extensions/error-classification.js';

// Export bulkhead extension
export type { 
  BulkheadOptions,
  BulkheadRejectionContext,
  BulkheadConfigContext 
} from './extensions/bulkhead.ts';
export { BulkheadExtension } from './extensions/bulkhead.ts';

// Export rate limiter extension
export type {
  RateLimitStrategy,
  RateLimiterOptions,
  RateLimitThrottlingContext,
  RateLimiterConfigContext
} from './extensions/rate-limiter.js';
export { RateLimiterExtension } from './extensions/rate-limiter.js';

// Export enhanced circuit breaker extension
export type {
  CircuitBreakerState,
  EnhancedCircuitBreakerOptions,
  CircuitBreakerStateChangeContext,
  CircuitBreakerConfigContext
} from './extensions/enhanced-circuit-breaker.js';
export { EnhancedCircuitBreakerExtension } from './extensions/enhanced-circuit-breaker.js';

// Export external system integration extension
export type {
  ExternalSystemIntegrationOptions,
  ExternalSystemOperationContext
} from './extensions/external-system-integration.js';
export {
  ExternalSystemIntegrationExtension,
  createExternalSystemIntegration
} from './extensions/external-system-integration.js';

// Export REST API adapter
export type {
  RestApiAdapterOptions
} from './extensions/rest-api-adapter.js';
export {
  RestApiAdapter,
  registerRestApiAdapter
} from './extensions/rest-api-adapter.js';

// Other extensions will be implemented in future updates
