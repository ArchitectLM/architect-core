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
export { 
  DefaultExtensionSystem, 
  createExtensionSystem,
  Extension,
  ExtensionPoint,
  Plugin,
  EventInterceptor,
  ExtensionHookHandler,
  ExtensionEvent
} from './extension-system.js';

// Export plugin management
export {
  PluginManager,
  createPluginManager,
  PluginMetadata,
  PluginRegistry
} from './plugin-management.js';

// Export event bus integration
export {
  EventBusIntegrationExtension,
  createExtendedEventBus,
  EventBus,
  EventBusIntegrationOptions
} from './extensions/event-bus-integration.js';

// Export error recovery extension
export {
  ErrorRecoveryExtension,
  RecoveryStrategy,
  RecoveryResult,
  RecoveryContext,
  FallbackHandler
} from './extensions/error-recovery.js';

// Export error classification extension
export {
  ErrorClassificationExtension,
  ErrorClassification,
  ErrorClassifier
} from './extensions/error-classification.js';

// Export bulkhead extension
export {
  BulkheadExtension,
  BulkheadOptions,
  BulkheadRejectionContext,
  BulkheadConfigContext
} from './extensions/bulkhead.js';

// Export rate limiter extension
export {
  RateLimiterExtension,
  RateLimitStrategy,
  RateLimiterOptions,
  RateLimitThrottlingContext,
  RateLimiterConfigContext
} from './extensions/rate-limiter.js';

// Export enhanced circuit breaker extension
export {
  EnhancedCircuitBreakerExtension,
  CircuitBreakerState,
  EnhancedCircuitBreakerOptions,
  CircuitBreakerStateChangeContext,
  CircuitBreakerConfigContext
} from './extensions/enhanced-circuit-breaker.js';

// Other extensions will be implemented in future updates
