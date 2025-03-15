/**
 * Service Integration
 * 
 * This module provides integration with external services.
 */

import {
  ServiceIntegration as ServiceIntegrationInterface,
  ServiceConfig,
  Service,
  ServiceType,
  ServiceOperation,
  WebhookHandlerConfig,
  WebhookHandler,
  WebhookEvent,
  RetryPolicy,
  CircuitBreakerOptions,
  ServiceIntegrationOptions
} from '../types/service';

import { Runtime } from '../types/index';
import { Extension } from '../interfaces/index';
import { ReactiveEventBus } from '../event-bus/index';
import { DefaultCircuitBreaker } from './circuit-breaker';

/**
 * Default service integration implementation
 */
export class DefaultServiceIntegration implements ServiceIntegrationInterface, Extension {
  name: string = 'service-integration';
  private services: Map<string, Service> = new Map();
  private webhookHandlers: Map<string, WebhookHandler> = new Map();
  private runtime: Runtime | null = null;
  private eventBus: ReactiveEventBus = new ReactiveEventBus();
  private options: ServiceIntegrationOptions;

  constructor(options: ServiceIntegrationOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize the extension with the runtime
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
  }

  /**
   * Register a service
   */
  registerService<T = any>(id: string, config: ServiceConfig): Service<T> {
    if (this.services.has(id)) {
      throw new Error(`Service with id '${id}' is already registered`);
    }

    const service: Service = {
      id,
      type: config.type,
      provider: config.provider,
      config: config.config,
      operations: config.operations || {},
      retryPolicy: config.retryPolicy || this.options.defaultRetryPolicy,
      webhookHandler: config.webhookHandler
    };

    if (config.circuitBreakerOptions || this.options.defaultCircuitBreakerOptions) {
      service.circuitBreaker = new DefaultCircuitBreaker(
        config.circuitBreakerOptions || this.options.defaultCircuitBreakerOptions!
      );
    }

    this.services.set(id, service);

    if (service.webhookHandler) {
      this.registerWebhookHandler(id, service.webhookHandler);
    }

    return service as Service<T>;
  }

  /**
   * Execute an operation on a service
   */
  async executeOperation<T = any, R = any>(
    serviceId: string,
    operationName: string,
    input: T
  ): Promise<R> {
    const service = this.getService(serviceId);
    if (!service) {
      throw new Error(`Service with id '${serviceId}' not found`);
    }

    const operation = service.operations[operationName];
    if (!operation) {
      throw new Error(`Operation '${operationName}' not found in service '${serviceId}'`);
    }

    const executeWithRetry = async (
      operation: ServiceOperation,
      input: any,
      retryCount: number = 0
    ): Promise<any> => {
      try {
        if (service.circuitBreaker) {
          return await service.circuitBreaker.execute(() => operation(input));
        } else {
          return await operation(input);
        }
      } catch (error) {
        if (service.retryPolicy && retryCount < service.retryPolicy.maxAttempts) {
          const delay = this.calculateRetryDelay(service.retryPolicy, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry(operation, input, retryCount + 1);
        }
        throw error;
      }
    };

    return executeWithRetry(operation, input) as Promise<R>;
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
    const handler = this.getWebhookHandler(serviceId);
    if (!handler) {
      throw new Error(`Webhook handler for service '${serviceId}' not found`);
    }

    const eventHandler = handler.handlers[event.type];
    if (!eventHandler) {
      throw new Error(`Handler for event type '${event.type}' not found in service '${serviceId}'`);
    }

    await eventHandler(event);
  }

  /**
   * Get a service by id
   */
  private getService(id: string): Service | undefined {
    return this.services.get(id);
  }

  /**
   * Calculate retry delay based on retry policy
   */
  private calculateRetryDelay(policy: RetryPolicy, retryCount: number): number {
    switch (policy.backoff) {
      case 'fixed':
        return policy.initialDelayMs;
      case 'linear':
        return policy.initialDelayMs * (retryCount + 1);
      case 'exponential':
        const factor = policy.factor || 2;
        const delay = policy.initialDelayMs * Math.pow(factor, retryCount);
        return policy.maxDelayMs ? Math.min(delay, policy.maxDelayMs) : delay;
      default:
        return policy.initialDelayMs;
    }
  }
}
