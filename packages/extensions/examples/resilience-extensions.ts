/**
 * Example of resilience pattern extensions
 */
import {
  DefaultExtensionSystem,
  ExtensionSystem,
  Extension,
  Plugin,
  EventInterceptor,
} from "../src/extension-system.js";
import { Event, BackoffStrategy } from "@architectlm/core";

// Utility function to simulate metrics recording
function recordMetric(name: string, value: any): void {
  console.log(`METRIC: ${name} = ${value}`);
}

// Utility function to simulate getting tenant configuration
function getTenantConfig(tenantId: string): any {
  const tenantConfigs: Record<string, any> = {
    "tenant1": {
      maxConcurrent: 20,
      maxQueue: 50,
      rateLimit: 200,
      retryAttempts: 5,
    },
    "tenant2": {
      maxConcurrent: 10,
      maxQueue: 20,
      rateLimit: 100,
      retryAttempts: 3,
    },
  };
  
  return tenantConfigs[tenantId] || {};
}

/**
 * Custom Backoff Strategy Extension
 * 
 * Provides additional backoff strategies beyond the built-in ones
 */
const customBackoffExtension: Extension = {
  name: "customBackoffStrategies",
  description: "Provides custom backoff strategies",
  hooks: {
    // Hook for providing custom backoff strategies
    "backoff.getStrategy": (context: any) => {
      // Adaptive backoff based on system load
      if (context.strategyName === "adaptive") {
        return (attempt: number, initialDelay: number) => {
          // Get current system load (simulated)
          const systemLoad = Math.random(); // 0-1 representing system load
          
          // Adjust delay based on system load
          const loadFactor = 1 + systemLoad * 2; // 1-3x multiplier based on load
          const baseDelay = initialDelay * Math.pow(1.5, attempt - 1);
          
          return baseDelay * loadFactor;
        };
      }
      
      // Stepped backoff with plateaus
      if (context.strategyName === "stepped") {
        return (attempt: number, initialDelay: number) => {
          // Steps at 1, 3, 5, 10 attempts
          if (attempt <= 2) return initialDelay;
          if (attempt <= 5) return initialDelay * 3;
          if (attempt <= 10) return initialDelay * 7;
          return initialDelay * 15;
        };
      }
      
      // Return null to use default strategy if not handled
      return null;
    }
  }
};

/**
 * Resilience Monitoring Extension
 * 
 * Monitors resilience pattern metrics
 */
const resilienceMonitoringExtension: Extension = {
  name: "resilienceMonitoring",
  description: "Monitors resilience pattern metrics",
  hooks: {
    // Circuit breaker state changes
    "circuitBreaker.stateChange": (context: any) => {
      recordMetric(`circuit_breaker.${context.name}.state`, context.newState);
      recordMetric(`circuit_breaker.${context.name}.transition_count`, 1);
      
      if (context.newState === "OPEN") {
        recordMetric(`circuit_breaker.${context.name}.open_count`, 1);
      }
      
      return context;
    },
    
    // Retry attempts
    "retry.attempt": (context: any) => {
      recordMetric(`retry.${context.name}.attempts`, context.attemptNumber);
      recordMetric(`retry.${context.name}.error_type`, context.error.name);
      
      // Record delay between attempts
      if (context.delay) {
        recordMetric(`retry.${context.name}.delay`, context.delay);
      }
      
      return context;
    },
    
    // Bulkhead rejections
    "bulkhead.rejected": (context: any) => {
      recordMetric(`bulkhead.${context.name}.rejected`, 1);
      recordMetric(`bulkhead.${context.name}.queue_size`, context.queueSize);
      recordMetric(`bulkhead.${context.name}.active_count`, context.activeCount);
      
      return context;
    },
    
    // Rate limiter throttling
    "rateLimit.throttled": (context: any) => {
      recordMetric(`rate_limiter.${context.name}.throttled`, 1);
      recordMetric(`rate_limiter.${context.name}.current_usage`, context.currentUsage);
      
      return context;
    },
    
    // Cache hits and misses
    "cache.access": (context: any) => {
      const hitOrMiss = context.hit ? "hit" : "miss";
      recordMetric(`cache.${context.name}.${hitOrMiss}`, 1);
      
      if (context.hit) {
        recordMetric(`cache.${context.name}.age`, Date.now() - context.storedAt);
      }
      
      return context;
    }
  }
};

/**
 * Multi-Tenancy Extension
 * 
 * Adjusts resilience configurations based on tenant
 */
const multiTenancyExtension: Extension = {
  name: "multiTenancy",
  description: "Provides tenant-specific resilience configurations",
  hooks: {
    // Configure bulkhead based on tenant
    "bulkhead.configure": (config: any) => {
      const tenantId = config.context?.tenantId;
      if (!tenantId) return config;
      
      const tenantConfig = getTenantConfig(tenantId);
      
      return {
        ...config,
        maxConcurrent: tenantConfig.maxConcurrent || config.maxConcurrent,
        maxQueue: tenantConfig.maxQueue || config.maxQueue
      };
    },
    
    // Configure rate limiter based on tenant
    "rateLimit.configure": (config: any) => {
      const tenantId = config.context?.tenantId;
      if (!tenantId) return config;
      
      const tenantConfig = getTenantConfig(tenantId);
      
      return {
        ...config,
        limit: tenantConfig.rateLimit || config.limit
      };
    },
    
    // Configure retry policy based on tenant
    "retry.configure": (config: any) => {
      const tenantId = config.context?.tenantId;
      if (!tenantId) return config;
      
      const tenantConfig = getTenantConfig(tenantId);
      
      return {
        ...config,
        maxAttempts: tenantConfig.retryAttempts || config.maxAttempts
      };
    }
  }
};

/**
 * Error Classification Extension
 * 
 * Classifies errors for better retry decisions
 */
const errorClassificationExtension: Extension = {
  name: "errorClassification",
  description: "Classifies errors for better retry decisions",
  hooks: {
    "error.classify": (error: Error) => {
      // Network errors are always retryable
      if (error.name === "NetworkError" || error.message.includes("network")) {
        return { 
          ...error, 
          type: "NETWORK", 
          retryable: true,
          priority: "high"
        };
      }
      
      // Timeout errors are retryable with exponential backoff
      if (error.name === "TimeoutError" || error.message.includes("timeout")) {
        return { 
          ...error, 
          type: "TIMEOUT", 
          retryable: true,
          backoffStrategy: BackoffStrategy.EXPONENTIAL,
          priority: "medium"
        };
      }
      
      // Rate limiting errors are retryable with decorrelated jitter
      if (error.name === "RateLimitError" || error.message.includes("rate limit")) {
        return { 
          ...error, 
          type: "RATE_LIMIT", 
          retryable: true,
          backoffStrategy: BackoffStrategy.DECORRELATED_JITTER,
          priority: "low"
        };
      }
      
      // Validation errors are not retryable
      if (error.name === "ValidationError" || error.message.includes("validation")) {
        return { 
          ...error, 
          type: "VALIDATION", 
          retryable: false,
          priority: "none"
        };
      }
      
      // Default classification
      return { 
        ...error, 
        type: "UNKNOWN", 
        retryable: false,
        priority: "low"
      };
    }
  }
};

/**
 * Resilience Telemetry Plugin
 * 
 * Combines monitoring with event interception for comprehensive telemetry
 */
const resilienceTelemetryPlugin: Plugin = {
  name: "resilienceTelemetry",
  description: "Provides comprehensive resilience telemetry",
  hooks: {
    ...resilienceMonitoringExtension.hooks,
    
    // Additional hooks for telemetry
    "resilience.operationStart": (context: any) => {
      recordMetric(`operation.${context.name}.start`, 1);
      context.startTime = Date.now();
      return context;
    },
    
    "resilience.operationEnd": (context: any) => {
      const duration = Date.now() - context.startTime;
      recordMetric(`operation.${context.name}.duration`, duration);
      recordMetric(`operation.${context.name}.success`, context.success ? 1 : 0);
      return context;
    }
  },
  
  // Event interceptors for tracking resilience-related events
  eventInterceptors: [
    (event: Event) => {
      // Add timing information to events
      const enhancedEvent = {
        ...event,
        metadata: {
          ...event.metadata,
          processedAt: Date.now()
        }
      };
      
      // Record metrics for resilience-related events
      if (event.type.startsWith("resilience.")) {
        recordMetric(`event.${event.type}`, 1);
      }
      
      return enhancedEvent;
    }
  ]
};

/**
 * Create and configure the extension system
 */
function createResilienceExtensionSystem(): ExtensionSystem {
  const extensionSystem = new DefaultExtensionSystem();
  
  // Register extension points
  extensionSystem.registerExtensionPoint({
    name: "backoff.getStrategy",
    description: "Provides custom backoff strategies for retry policies"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "circuitBreaker.stateChange",
    description: "Triggered when a circuit breaker changes state"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "retry.attempt",
    description: "Triggered when a retry is attempted"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "bulkhead.rejected",
    description: "Triggered when a request is rejected by a bulkhead"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "rateLimit.throttled",
    description: "Triggered when a request is throttled by a rate limiter"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "cache.access",
    description: "Triggered when a cache is accessed"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "bulkhead.configure",
    description: "Allows modification of bulkhead configuration"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "rateLimit.configure",
    description: "Allows modification of rate limiter configuration"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "retry.configure",
    description: "Allows modification of retry policy configuration"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "error.classify",
    description: "Classifies errors for better handling"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "resilience.operationStart",
    description: "Triggered when a resilient operation starts"
  });
  
  extensionSystem.registerExtensionPoint({
    name: "resilience.operationEnd",
    description: "Triggered when a resilient operation ends"
  });
  
  // Register extensions
  extensionSystem.registerExtension(customBackoffExtension);
  extensionSystem.registerExtension(multiTenancyExtension);
  extensionSystem.registerExtension(errorClassificationExtension);
  
  // Register plugin
  extensionSystem.registerPlugin(resilienceTelemetryPlugin);
  
  return extensionSystem;
}

// Example usage
async function example() {
  const extensionSystem = createResilienceExtensionSystem();
  
  // Example: Get a custom backoff strategy
  const strategyContext = await extensionSystem.triggerExtensionPoint("backoff.getStrategy", {
    strategyName: "adaptive",
    initialDelay: 100
  });
  
  if (strategyContext && typeof strategyContext === "function") {
    const delay = strategyContext(2, 100);
    console.log(`Adaptive backoff delay for attempt 2: ${delay}ms`);
  }
  
  // Example: Classify an error
  const error = new Error("Connection timeout after 5000ms");
  error.name = "TimeoutError";
  
  const classifiedError = await extensionSystem.triggerExtensionPoint("error.classify", error);
  console.log("Classified error:", classifiedError);
  
  // Example: Configure bulkhead for a specific tenant
  const bulkheadConfig = await extensionSystem.triggerExtensionPoint("bulkhead.configure", {
    maxConcurrent: 5,
    maxQueue: 10,
    context: {
      tenantId: "tenant1"
    }
  });
  
  console.log("Tenant-specific bulkhead config:", bulkheadConfig);
  
  // Example: Process an event through interceptors
  const originalEvent: Event = {
    type: "resilience.retry",
    payload: {
      operation: "fetchData",
      attempt: 2,
      error: "Timeout"
    },
    timestamp: Date.now(),
    metadata: {}
  };
  
  const processedEvent = extensionSystem.processEventThroughInterceptors(originalEvent);
  console.log("Processed event:", processedEvent);
}

// Export the example and extension system
export {
  createResilienceExtensionSystem,
  customBackoffExtension,
  resilienceMonitoringExtension,
  multiTenancyExtension,
  errorClassificationExtension,
  resilienceTelemetryPlugin,
  example
}; 