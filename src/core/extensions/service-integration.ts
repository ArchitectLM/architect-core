/**
 * Service Integration Extension for ArchitectLM
 * 
 * This extension provides integration with external services like payment processors,
 * shipping providers, tax calculators, etc. for e-commerce applications.
 */

import { 
  ServiceIntegrationExtension, 
  ServiceIntegrationConfig, 
  ServiceConfig, 
  Service, 
  ServiceType, 
  ServiceOperation, 
  WebhookHandlerConfig, 
  WebhookHandler, 
  WebhookEvent, 
  RetryPolicy 
} from './types';
import { Extension, Runtime } from '../types';
import { ReactiveEventBus } from '../event-bus';

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
  }
};

/**
 * Service Integration Extension implementation
 */
export class ServiceIntegration implements Extension, ServiceIntegrationExtension {
  name = 'service-integration';
  private config: ServiceIntegrationConfig;
  private runtime?: Runtime;
  public services: Map<string, Service> = new Map();
  private webhookHandlers: Map<string, WebhookHandler> = new Map();
  
  constructor(config: Partial<ServiceIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initialize the extension with the runtime
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    
    // Register this extension as a service
    runtime.registerService('service-integration', this);
    
    console.log(`Service Integration extension initialized`);
  }
  
  /**
   * Register a service
   */
  registerService<T = any>(id: string, config: ServiceConfig): Service<T> {
    const service: Service<T> = {
      id,
      type: config.type,
      provider: config.provider,
      config: config.config,
      operations: config.operations || {},
      retryPolicy: config.retryPolicy || this.config.defaultRetryPolicy,
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
    
    // If no retry policy, just execute the operation
    if (!service.retryPolicy) {
      return operation(input) as Promise<R>;
    }
    
    // Execute with retry
    return this.executeWithRetry<T, R>(
      operation as ServiceOperation<T, R>,
      input,
      service.retryPolicy
    );
  }
  
  /**
   * Execute an operation with retry
   */
  private async executeWithRetry<T = any, R = any>(
    operation: ServiceOperation<T, R>,
    input: T,
    retryPolicy: RetryPolicy,
    attempt = 1
  ): Promise<R> {
    try {
      return await operation(input);
    } catch (error) {
      // If we've reached the maximum number of attempts, throw the error
      if (attempt >= retryPolicy.maxAttempts) {
        throw error;
      }
      
      // Calculate delay based on backoff strategy
      let delay = retryPolicy.initialDelayMs;
      
      if (retryPolicy.backoff === 'exponential') {
        const factor = retryPolicy.factor || 2;
        delay = retryPolicy.initialDelayMs * Math.pow(factor, attempt - 1);
      } else if (retryPolicy.backoff === 'linear') {
        const factor = retryPolicy.factor || 1;
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
   */
  getWebhookHandler(serviceId: string): WebhookHandler | undefined {
    return this.webhookHandlers.get(serviceId);
  }
  
  /**
   * Process a webhook event
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
   * DSL for creating services
   */
  static Service = {
    /**
     * Create a new service builder
     */
    create: (id: string) => new ServiceBuilder(id)
  };
}

/**
 * Service Builder for fluent API
 */
export class ServiceBuilder<T = any> {
  private id: string;
  private type?: ServiceType;
  private provider?: string;
  private config: Record<string, any> = {};
  private operations: Record<string, ServiceOperation> = {};
  private retryPolicy?: RetryPolicy;
  private webhookHandlerConfig?: WebhookHandlerConfig;
  
  constructor(id: string) {
    this.id = id;
  }
  
  /**
   * Set the service type
   */
  withType(type: ServiceType): this {
    this.type = type;
    return this;
  }
  
  /**
   * Set the service provider
   */
  withProvider(provider: string): this {
    this.provider = provider;
    return this;
  }
  
  /**
   * Set the service configuration
   */
  withConfig(config: Record<string, any>): this {
    this.config = config;
    return this;
  }
  
  /**
   * Add an operation to the service
   */
  withOperation<I = any, O = any>(name: string, operation: ServiceOperation<I, O>): this {
    this.operations[name] = operation;
    return this;
  }
  
  /**
   * Set the retry policy for the service
   */
  withRetryPolicy(retryPolicy: RetryPolicy): this {
    this.retryPolicy = retryPolicy;
    return this;
  }
  
  /**
   * Set the webhook handler for the service
   */
  withWebhookHandler(config: WebhookHandlerConfig): this {
    this.webhookHandlerConfig = config;
    return this;
  }
  
  /**
   * Build the service configuration
   */
  build(): ServiceConfig {
    if (!this.type) {
      throw new Error('Service type is required');
    }
    
    if (!this.provider) {
      throw new Error('Service provider is required');
    }
    
    return {
      type: this.type,
      provider: this.provider,
      config: this.config,
      operations: this.operations,
      retryPolicy: this.retryPolicy,
      webhookHandler: this.webhookHandlerConfig
    };
  }
} 