import { Extension } from '../extension-system.js';

/**
 * Type for resilience policy configuration
 */
export type ResilienceConfig = Record<string, any>;

/**
 * Interface for the context passed to the contextual policy extension point
 */
export interface ContextualPolicyContext {
  /** The type of policy to get (retry, circuitBreaker, etc.) */
  policyType: string;
  /** Additional context information */
  context: Record<string, any>;
}

/**
 * Type for system metrics
 */
export interface SystemMetrics {
  /** CPU load (0-1) */
  cpuLoad: number;
  /** Memory usage (0-1) */
  memoryUsage: number;
  /** Current request rate */
  requestRate: number;
  /** Additional metrics */
  [key: string]: any;
}

/**
 * Type for a dynamic configuration provider function
 */
export type DynamicConfigProvider = (
  context: ContextualPolicyContext,
  metrics: SystemMetrics
) => ResilienceConfig | null;

/**
 * Type for an environment provider function
 */
export type EnvironmentProvider = () => string;

/**
 * Type for a system metrics provider function
 */
export type SystemMetricsProvider = () => SystemMetrics;

/**
 * Extension that provides context-aware resilience configurations
 */
export class ContextualPolicyExtension implements Extension {
  name = 'contextual-policy';
  description = 'Provides context-aware resilience configurations';
  
  private tenantConfigs: Map<string, Record<string, ResilienceConfig>> = new Map();
  private serviceConfigs: Map<string, Record<string, ResilienceConfig>> = new Map();
  private environmentConfigs: Map<string, Record<string, ResilienceConfig>> = new Map();
  private dynamicProviders: DynamicConfigProvider[] = [];
  
  private environmentProvider: EnvironmentProvider = () => 'development';
  private metricsProvider: SystemMetricsProvider = () => ({
    cpuLoad: 0.5,
    memoryUsage: 0.5,
    requestRate: 50
  });
  
  /**
   * Set the environment provider function
   * @param provider The function that provides the current environment
   */
  setEnvironmentProvider(provider: EnvironmentProvider): void {
    this.environmentProvider = provider;
  }
  
  /**
   * Set the system metrics provider function
   * @param provider The function that provides the current system metrics
   */
  setSystemMetricsProvider(provider: SystemMetricsProvider): void {
    this.metricsProvider = provider;
  }
  
  /**
   * Register a tenant-specific configuration
   * @param tenantId The ID of the tenant
   * @param config The configuration for the tenant
   */
  registerTenantConfig(tenantId: string, config: Record<string, ResilienceConfig>): void {
    this.tenantConfigs.set(tenantId, config);
  }
  
  /**
   * Register a service-specific configuration
   * @param serviceId The ID of the service
   * @param config The configuration for the service
   */
  registerServiceConfig(serviceId: string, config: Record<string, ResilienceConfig>): void {
    this.serviceConfigs.set(serviceId, config);
  }
  
  /**
   * Register an environment-specific configuration
   * @param environment The environment name
   * @param config The configuration for the environment
   */
  registerEnvironmentConfig(environment: string, config: Record<string, ResilienceConfig>): void {
    this.environmentConfigs.set(environment, config);
  }
  
  /**
   * Register a dynamic configuration provider
   * @param provider The function that provides dynamic configurations
   */
  registerDynamicConfigProvider(provider: DynamicConfigProvider): void {
    this.dynamicProviders.push(provider);
  }
  
  /**
   * Get a tenant-specific configuration
   * @param tenantId The ID of the tenant
   * @param policyType The type of policy
   * @returns The configuration or null if not found
   */
  private getTenantConfig(tenantId: string, policyType: string): ResilienceConfig | null {
    const config = this.tenantConfigs.get(tenantId);
    return config?.[policyType] || null;
  }
  
  /**
   * Get a service-specific configuration
   * @param serviceId The ID of the service
   * @param policyType The type of policy
   * @returns The configuration or null if not found
   */
  private getServiceConfig(serviceId: string, policyType: string): ResilienceConfig | null {
    const config = this.serviceConfigs.get(serviceId);
    return config?.[policyType] || null;
  }
  
  /**
   * Get an environment-specific configuration
   * @param policyType The type of policy
   * @returns The configuration or null if not found
   */
  private getEnvironmentConfig(policyType: string): ResilienceConfig | null {
    const environment = this.environmentProvider();
    const config = this.environmentConfigs.get(environment);
    return config?.[policyType] || null;
  }
  
  /**
   * Get a dynamic configuration
   * @param context The context for the configuration
   * @returns The configuration or null if not found
   */
  private getDynamicConfig(context: ContextualPolicyContext): ResilienceConfig | null {
    const metrics = this.metricsProvider();
    
    for (const provider of this.dynamicProviders) {
      const config = provider(context, metrics);
      if (config) {
        return config;
      }
    }
    
    // Default dynamic configuration for rate limiting based on system load
    if (context.policyType === 'rateLimit') {
      const cpuLoad = metrics.cpuLoad;
      const baseLimit = 1000;
      
      // Calculate limit based on available CPU capacity
      // As CPU load increases, we reduce the rate limit
      const limit = Math.floor(baseLimit * (1 - cpuLoad));
      
      return {
        limit,
        window: 60000 // 1 minute in milliseconds
      };
    }
    
    return null;
  }
  
  hooks = {
    'resilience.getContextualConfig': (context: ContextualPolicyContext) => {
      const { policyType, context: contextData } = context;
      
      // Try to get a dynamic configuration first
      const dynamicConfig = this.getDynamicConfig(context);
      if (dynamicConfig) {
        return dynamicConfig;
      }
      
      // Try to get a tenant-specific configuration
      if (contextData.tenant) {
        const tenantConfig = this.getTenantConfig(contextData.tenant, policyType);
        if (tenantConfig) {
          return tenantConfig;
        }
      }
      
      // Try to get a service-specific configuration
      if (contextData.service) {
        const serviceConfig = this.getServiceConfig(contextData.service, policyType);
        if (serviceConfig) {
          return serviceConfig;
        }
      }
      
      // Try to get an environment-specific configuration
      const environmentConfig = this.getEnvironmentConfig(policyType);
      if (environmentConfig) {
        return environmentConfig;
      }
      
      // No configuration found
      return null;
    }
  };
} 