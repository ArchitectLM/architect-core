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
} from './extension-system.ts';

// Export plugin management
export {
  PluginManager,
  createPluginManager,
  PluginMetadata,
  PluginRegistry
} from './plugin-management.ts';

// Export external system adapter
export {
  ExternalSystemAdapter,
  ExternalSystemAdapterConfig,
  ExternalSystemAdapterFactory,
  MemoryExternalSystemAdapter,
  MemoryExternalSystemAdapterOptions,
  externalSystemAdapterFactory
} from './external-system-adapter.ts';

// Export event bus integration
export {
  EventBusIntegrationExtension,
  createExtendedEventBus,
  EventBus,
  EventBusIntegrationOptions
} from './extensions/event-bus-integration.ts';

// Export error recovery extension
export {
  ErrorRecoveryExtension,
  RecoveryStrategy,
  RecoveryResult,
  RecoveryContext,
  FallbackHandler
} from './extensions/error-recovery.ts';

// Export error classification extension
export {
  ErrorClassificationExtension,
  ErrorClassification,
  ErrorClassifier
} from './extensions/error-classification.ts';

// Export bulkhead extension
export {
  BulkheadExtension,
  BulkheadOptions,
  BulkheadRejectionContext,
  BulkheadConfigContext
} from './extensions/bulkhead.ts';

// Export rate limiter extension
export {
  RateLimiterExtension,
  RateLimitStrategy,
  RateLimiterOptions,
  RateLimitThrottlingContext,
  RateLimiterConfigContext
} from './extensions/rate-limiter.ts';

// Export enhanced circuit breaker extension
export {
  EnhancedCircuitBreakerExtension,
  CircuitBreakerState,
  EnhancedCircuitBreakerOptions,
  CircuitBreakerStateChangeContext,
  CircuitBreakerConfigContext
} from './extensions/enhanced-circuit-breaker.ts';

// Export external system integration extension
export {
  ExternalSystemIntegrationExtension,
  ExternalSystemIntegrationOptions,
  ExternalSystemOperationContext,
  createExternalSystemIntegration
} from './extensions/external-system-integration.ts';

// Export REST API adapter
export {
  RestApiAdapter,
  RestApiAdapterOptions,
  registerRestApiAdapter
} from './extensions/rest-api-adapter.ts';

// Other extensions will be implemented in future updates
