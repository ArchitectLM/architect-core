/**
 * Service Builder for the fluent API
 * 
 * This builder provides a fluent interface for creating service integrations
 * for external services like payment processors, shipping providers, etc.
 */

import { 
  ServiceType, 
  ServiceOperation, 
  WebhookHandlerConfig, 
  RetryPolicy,
  ServiceConfig
} from '../extensions/types';

/**
 * Service Builder class for the fluent API
 */
export class ServiceBuilder<T = any> {
  private id: string;
  private type?: ServiceType;
  private provider?: string;
  private config: Record<string, any> = {};
  private operations: Record<string, ServiceOperation> = {};
  private retryPolicy?: RetryPolicy;
  private webhookHandlerConfig?: WebhookHandlerConfig;
  
  /**
   * Create a new service builder
   * @param id Unique identifier for the service
   */
  constructor(id: string) {
    this.id = id;
  }
  
  /**
   * Static factory method to create a new service builder
   * @param id Unique identifier for the service
   * @returns A new service builder instance
   */
  static create<T = any>(id: string): ServiceBuilder<T> {
    return new ServiceBuilder<T>(id);
  }
  
  /**
   * Set the service type
   * @param type Type of service (payment, shipping, etc.)
   */
  withType(type: ServiceType): this {
    this.type = type;
    return this;
  }
  
  /**
   * Set the service provider
   * @param provider Provider name (Stripe, PayPal, etc.)
   */
  withProvider(provider: string): this {
    this.provider = provider;
    return this;
  }
  
  /**
   * Set the service configuration
   * @param config Configuration object for the service
   */
  withConfig(config: Record<string, any>): this {
    this.config = config;
    return this;
  }
  
  /**
   * Add an operation to the service
   * @param name Operation name
   * @param operation Operation implementation function
   */
  withOperation<I = any, O = any>(name: string, operation: ServiceOperation<I, O>): this {
    this.operations[name] = operation;
    return this;
  }
  
  /**
   * Set the retry policy for the service
   * @param retryPolicy Retry policy configuration
   */
  withRetryPolicy(retryPolicy: RetryPolicy): this {
    this.retryPolicy = retryPolicy;
    return this;
  }
  
  /**
   * Set the webhook handler for the service
   * @param config Webhook handler configuration
   */
  withWebhookHandler(config: WebhookHandlerConfig): this {
    this.webhookHandlerConfig = config;
    return this;
  }
  
  /**
   * Build the service configuration
   * @returns Service configuration object
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

/**
 * Service namespace for the fluent API
 */
export const Service = {
  /**
   * Create a new service builder
   * @param id Unique identifier for the service
   * @returns A new service builder instance
   */
  create: <T = any>(id: string) => ServiceBuilder.create<T>(id)
}; 