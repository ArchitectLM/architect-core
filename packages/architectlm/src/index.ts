/**
 * ArchitectLM
 *
 * Main entry point for the ArchitectLM framework
 */

// Core exports
export {
  // Core types
  Process,
  ProcessBuilder,
  Task,
  TaskBuilder,
} from '@architectlm/core';

// DSL exports
export {
  // DSL types
  ReactiveSystem,
  ReactiveSystemBuilder,
} from '@architectlm/dsl';

// Extensions exports
export {
  // Extension interfaces
  Extension,
  ServiceRegistry,
  ArchitectAgent,
  // Extension types
  Event,
  ProcessInstance,
  Runtime,
  ProcessDefinition,
  TaskDefinition,
  SystemConfig,
  TestDefinition,
  TaskImplementation,
  // Service types
  ServiceType,
  ServiceOperation,
  WebhookHandlerConfig,
  WebhookHandler,
  WebhookEvent,
  RetryPolicy,
  ServiceConfig,
  Service,
  CircuitBreakerOptions,
  CircuitBreakerState,
  CircuitBreaker,
  ServiceIntegration,
  // Implementations
  ReactiveEventBus,
  DefaultServiceIntegration,
  DefaultCircuitBreaker,
} from '@architectlm/extensions';

// CLI exports
export { registerCommands } from '@architectlm/cli';
