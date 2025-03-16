/**
 * Service Integration Extension for ArchitectLM
 * 
 * This extension provides integration with external services like payment processors,
 * shipping providers, tax calculators, etc. for e-commerce applications.
 */

import { 
  ServiceIntegrationExtension as ServiceIntegrationInterface, 
  ServiceIntegrationConfig, 
  ServiceConfig, 
  Service, 
  ServiceType, 
  ServiceOperation, 
  WebhookHandlerConfig, 
  WebhookHandler, 
  WebhookEvent, 
  RetryPolicy,
  CircuitBreakerOptions,
  CircuitBreaker
} from './types';
import { Runtime } from '../types';
import { Extension } from './interfaces';
import { ReactiveEventBus } from '../event-bus';
import { DefaultCircuitBreaker } from './circuit-breaker';

/**
 * Default configuration for the service integration extension
 */
const DEFAULT_CONFIG: ServiceIntegrationConfig = {
  enabled: true,
  defaultRetryPolicy: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelayMs: 100,
    maxDelayMs: 5000
  },
  defaultCircuitBreakerOptions: {
    failureThreshold: 5,
    resetTimeoutMs: 30000, // 30 seconds
    successThreshold: 2
  }
};

/**
 * Service Integration Extension implementation
 */
export class ServiceIntegration implements Extension, ServiceIntegrationInterface {
  name = 'service-integration';
  public services: Map<string, Service> = new Map();
  private webhookHandlers: Map<string, WebhookHandler> = new Map();
  private eventBus!: ReactiveEventBus;
  private config: ServiceIntegrationConfig;
  private runtime?: Runtime;
  
  constructor(config: Partial<ServiceIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initialize the extension
   * @param runtime The runtime instance
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    
    // Register this extension as a service
    runtime.registerService('service-integration', this);
    
    console.log(`Service Integration extension initialized`);
  }
  
  /**
   * Register a service
   * @param id Service ID
   * @param config Service configuration
   * @returns The registered service
   */
  registerService<T = any>(id: string, config: ServiceConfig): Service<T> {
    const service: Service<T> = {
      id,
      type: config.type,
      provider: config.provider,
      config: config.config,
      operations: config.operations || {},
      retryPolicy: config.retryPolicy || this.config.defaultRetryPolicy,
      circuitBreaker: !config.circuitBreakerOptions && this.config.defaultCircuitBreakerOptions 
        ? new DefaultCircuitBreaker(this.config.defaultCircuitBreakerOptions)
        : config.circuitBreakerOptions ? new DefaultCircuitBreaker(config.circuitBreakerOptions) : undefined,
      webhookHandler: config.webhookHandler ? {
        path: config.webhookHandler.path,
        secret: config.webhookHandler.secret,
        handlers: config.webhookHandler.handlers
      } : undefined
    };
    
    this.services.set(id, service);
    
    // Register webhook handler if provided
    if (service.webhookHandler) {
      this.registerWebhookHandler(id, service.webhookHandler);
    }
    
    return service;
  }
  
  /**
   * Execute an operation on a service
   * @param serviceId Service ID
   * @param operationName Operation name
   * @param input Operation input
   * @returns Operation result
   */
  async executeOperation<T = any, R = any>(
    serviceId: string, 
    operationName: string, 
    input: T
  ): Promise<R> {
    const service = this.services.get(serviceId);
    
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    
    const operation = service.operations[operationName];
    
    if (!operation) {
      throw new Error(`Operation not found: ${operationName} on service ${serviceId}`);
    }
    
    try {
      // Execute operation with circuit breaker if available
      if (service.circuitBreaker) {
        return await service.circuitBreaker.execute(async () => {
          return await this.executeWithRetry(operation, input, service.retryPolicy);
        }) as R;
      } else {
        // Execute with retry if policy exists
        return await this.executeWithRetry(operation, input, service.retryPolicy) as R;
      }
    } catch (error) {
      // Emit error event if runtime is available
      if (this.runtime) {
        this.runtime.emitEvent({
          type: `service.${serviceId}.error`,
          payload: {
            operationName,
            input,
            error
          }
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Execute an operation with retry
   * @param operation Operation to execute
   * @param input Operation input
   * @param retryPolicy Retry policy
   * @param attempt Current attempt number
   * @returns Operation result
   */
  private async executeWithRetry<T = any, R = any>(
    operation: ServiceOperation,
    input: T,
    retryPolicy?: RetryPolicy,
    attempt = 1
  ): Promise<R> {
    try {
      return await operation(input) as R;
    } catch (error) {
      // If no retry policy or we've reached the maximum number of attempts, throw the error
      if (!retryPolicy || attempt >= retryPolicy.maxAttempts) {
        throw error;
      }
      
      // Calculate delay based on backoff strategy
      let delay = retryPolicy.initialDelayMs;
      
      if (retryPolicy.backoff === 'exponential') {
        const factor = 2;
        delay = retryPolicy.initialDelayMs * Math.pow(factor, attempt - 1);
      } else if (retryPolicy.backoff === 'linear') {
        const factor = 1;
        delay = retryPolicy.initialDelayMs * (1 + (attempt - 1) * factor);
      }
      
      // Cap the delay at maxDelayMs if specified
      if (retryPolicy.maxDelayMs && delay > retryPolicy.maxDelayMs) {
        delay = retryPolicy.maxDelayMs;
      }
      
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the operation
      return this.executeWithRetry(operation, input, retryPolicy, attempt + 1);
    }
  }
  
  /**
   * Register a webhook handler for a service
   * @param serviceId Service ID
   * @param config Webhook handler configuration
   * @returns The registered webhook handler
   */
  registerWebhookHandler(serviceId: string, config: WebhookHandlerConfig): WebhookHandler {
    const handler: WebhookHandler = {
      path: config.path,
      secret: config.secret,
      handlers: config.handlers
    };
    
    this.webhookHandlers.set(serviceId, handler);
    
    return handler;
  }
  
  /**
   * Get a webhook handler for a service
   * @param serviceId Service ID
   * @returns The webhook handler or undefined if not found
   */
  getWebhookHandler(serviceId: string): WebhookHandler | undefined {
    return this.webhookHandlers.get(serviceId);
  }
  
  /**
   * Process a webhook event
   * @param serviceId Service ID
   * @param event Webhook event
   */
  async processWebhookEvent(serviceId: string, event: WebhookEvent): Promise<void> {
    const handler = this.webhookHandlers.get(serviceId);
    
    if (!handler) {
      throw new Error(`Webhook handler not found for service: ${serviceId}`);
    }
    
    const eventHandler = handler.handlers[event.type];
    
    if (!eventHandler) {
      console.warn(`No handler registered for event type: ${event.type} on service ${serviceId}`);
      return;
    }
    
    await eventHandler(event);
    
    // Emit an event on the runtime event bus if available
    if (this.runtime) {
      this.runtime.emitEvent({
        type: `service.${serviceId}.${event.type}`,
        payload: event.data
      });
    }
  }
  
  /**
   * Get a registered service by ID
   * @param serviceId Service ID
   * @returns The service or undefined if not found
   */
  getService(serviceId: string): Service | undefined {
    return this.services.get(serviceId);
  }
  
  /**
   * Get all registered services
   * @returns Array of registered services
   */
  getAllServices(): Service[] {
    return Array.from(this.services.values());
  }
}

/**
 * Create a service integration extension
 * @param config The extension configuration
 * @returns A new service integration extension
 */
export function createServiceIntegration(
  config: Partial<ServiceIntegrationConfig> = {}
): ServiceIntegration {
  return new ServiceIntegration(config);
} 