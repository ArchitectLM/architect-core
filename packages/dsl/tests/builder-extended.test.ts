import { describe, it, expect } from 'vitest';
import {
  createCircuitBreakerConfig,
  createEnhancedCircuitBreakerConfig,
  createRetryConfig,
  createEnhancedRetryConfig,
  createBulkheadConfig,
  createRateLimiterConfig,
  createCacheConfig,
  createDeadLetterQueueConfig,
  createDistributedTracingConfig,
  createErrorClassificationConfig,
  createContextualPolicyConfig,
  createEventTransformationConfig,
  createMonitoringConfig,
  createResilienceConfig
} from '../src/builder.js';
import { BackoffStrategy, RateLimitStrategy } from '../src/models.js';

describe('Builder Helper Functions', () => {
  describe('Circuit Breaker Configurations', () => {
    it('should create a basic circuit breaker config', () => {
      const config = createCircuitBreakerConfig(5, 1000, 3);
      
      expect(config.failureThreshold).toBe(5);
      expect(config.resetTimeout).toBe(1000);
      expect(config.halfOpenSuccessThreshold).toBe(3);
    });
    
    it('should create an enhanced circuit breaker config', () => {
      const config = createEnhancedCircuitBreakerConfig(5, 1000, {
        halfOpenSuccessThreshold: 3,
        isFailure: 'isFailureFunc',
        onStateChange: 'stateChangeHandler',
        onReset: 'resetHandler',
        onSuccess: 'successHandler',
        onFailure: 'failureHandler'
      });
      
      expect(config.failureThreshold).toBe(5);
      expect(config.resetTimeout).toBe(1000);
      expect(config.halfOpenSuccessThreshold).toBe(3);
      expect(config.isFailure).toBe('isFailureFunc');
      expect(config.onStateChange).toBe('stateChangeHandler');
      expect(config.onReset).toBe('resetHandler');
      expect(config.onSuccess).toBe('successHandler');
      expect(config.onFailure).toBe('failureHandler');
    });
  });
  
  describe('Retry Configurations', () => {
    it('should create a basic retry config', () => {
      const config = createRetryConfig(3, 'exponential', 100, 5000);
      
      expect(config.maxAttempts).toBe(3);
      expect(config.backoff).toBe('exponential');
      expect(config.initialDelay).toBe(100);
      expect(config.maxDelay).toBe(5000);
    });
    
    it('should create an enhanced retry config', () => {
      const config = createEnhancedRetryConfig(
        3,
        BackoffStrategy.EXPONENTIAL,
        100,
        5000,
        {
          factor: 2,
          onRetry: 'retryHandler',
          shouldRetry: 'shouldRetryFunc'
        }
      );
      
      expect(config.maxAttempts).toBe(3);
      expect(config.strategy).toBe(BackoffStrategy.EXPONENTIAL);
      expect(config.initialDelay).toBe(100);
      expect(config.maxDelay).toBe(5000);
      expect(config.factor).toBe(2);
      expect(config.onRetry).toBe('retryHandler');
      expect(config.shouldRetry).toBe('shouldRetryFunc');
    });
  });
  
  describe('Bulkhead Configuration', () => {
    it('should create a bulkhead config', () => {
      const config = createBulkheadConfig(10, 5, 2000);
      
      expect(config.maxConcurrent).toBe(10);
      expect(config.maxQueue).toBe(5);
      expect(config.timeout).toBe(2000);
    });
    
    it('should create a bulkhead config with defaults', () => {
      const config = createBulkheadConfig(10);
      
      expect(config.maxConcurrent).toBe(10);
      expect(config.maxQueue).toBeUndefined();
      expect(config.timeout).toBeUndefined();
    });
  });
  
  describe('Rate Limiter Configuration', () => {
    it('should create a token bucket rate limiter config', () => {
      const config = createRateLimiterConfig(
        RateLimitStrategy.TOKEN_BUCKET,
        100,
        {
          refillRate: 10,
          refillInterval: 1000
        }
      );
      
      expect(config.strategy).toBe(RateLimitStrategy.TOKEN_BUCKET);
      expect(config.limit).toBe(100);
      expect(config.refillRate).toBe(10);
      expect(config.refillInterval).toBe(1000);
    });
    
    it('should create a fixed window rate limiter config', () => {
      const config = createRateLimiterConfig(
        RateLimitStrategy.FIXED_WINDOW,
        100,
        { window: 60000 }
      );
      
      expect(config.strategy).toBe(RateLimitStrategy.FIXED_WINDOW);
      expect(config.limit).toBe(100);
      expect(config.window).toBe(60000);
    });
  });
  
  describe('Cache Configuration', () => {
    it('should create a cache config', () => {
      const config = createCacheConfig(60000, 1000, true);
      
      expect(config.ttl).toBe(60000);
      expect(config.maxSize).toBe(1000);
      expect(config.staleWhileRevalidate).toBe(true);
    });
    
    it('should create a cache config with defaults', () => {
      const config = createCacheConfig(60000);
      
      expect(config.ttl).toBe(60000);
      expect(config.maxSize).toBeUndefined();
      expect(config.staleWhileRevalidate).toBeUndefined();
    });
  });
  
  describe('Dead Letter Queue Configuration', () => {
    it('should create a dead letter queue config', () => {
      const config = createDeadLetterQueueConfig(3, 1000, 'errorHandler');
      
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.errorHandler).toBe('errorHandler');
    });
    
    it('should create a dead letter queue config with defaults', () => {
      const config = createDeadLetterQueueConfig();
      
      expect(config.maxRetries).toBeUndefined();
      expect(config.retryDelay).toBeUndefined();
      expect(config.errorHandler).toBeUndefined();
    });
  });
  
  describe('Distributed Tracing Configuration', () => {
    it('should create a distributed tracing config', () => {
      const config = createDistributedTracingConfig('my-service', {
        sampleRate: 0.1,
        propagationHeaders: ['x-trace-id', 'x-span-id'],
        exporterEndpoint: 'http://jaeger:14268/api/traces',
        tags: { environment: 'production' }
      });
      
      expect(config.serviceName).toBe('my-service');
      expect(config.sampleRate).toBe(0.1);
      expect(config.propagationHeaders).toEqual(['x-trace-id', 'x-span-id']);
      expect(config.exporterEndpoint).toBe('http://jaeger:14268/api/traces');
      expect(config.tags).toEqual({ environment: 'production' });
    });
    
    it('should create a distributed tracing config with defaults', () => {
      const config = createDistributedTracingConfig('my-service');
      
      expect(config.serviceName).toBe('my-service');
      expect(config.sampleRate).toBeUndefined();
      expect(config.propagationHeaders).toBeUndefined();
      expect(config.exporterEndpoint).toBeUndefined();
      expect(config.tags).toBeUndefined();
    });
  });
  
  describe('Error Classification Configuration', () => {
    it('should create an error classification config', () => {
      const config = createErrorClassificationConfig({
        retryableErrors: ['NetworkError', 'TimeoutError'],
        fatalErrors: ['AuthenticationError'],
        timeoutErrors: ['TimeoutError'],
        networkErrors: ['NetworkError'],
        classifier: 'customClassifier'
      });
      
      expect(config.retryableErrors).toEqual(['NetworkError', 'TimeoutError']);
      expect(config.fatalErrors).toEqual(['AuthenticationError']);
      expect(config.timeoutErrors).toEqual(['TimeoutError']);
      expect(config.networkErrors).toEqual(['NetworkError']);
      expect(config.classifier).toBe('customClassifier');
    });
    
    it('should create an error classification config with defaults', () => {
      const config = createErrorClassificationConfig();
      
      expect(config.retryableErrors).toBeUndefined();
      expect(config.fatalErrors).toBeUndefined();
      expect(config.timeoutErrors).toBeUndefined();
      expect(config.networkErrors).toBeUndefined();
      expect(config.classifier).toBeUndefined();
    });
  });
  
  describe('Contextual Policy Configuration', () => {
    it('should create a contextual policy config', () => {
      const policies = {
        'read': { timeout: 1000 },
        'write': { timeout: 5000 }
      };
      
      const config = createContextualPolicyConfig(policies, 'operationSelector');
      
      expect(config.policies).toEqual(policies);
      expect(config.selector).toBe('operationSelector');
    });
  });
  
  describe('Event Transformation Configuration', () => {
    it('should create an event transformation config', () => {
      const transformers = {
        'UserCreated': 'userCreatedTransformer',
        'OrderPlaced': 'orderPlacedTransformer'
      };
      
      const config = createEventTransformationConfig(transformers, 'globalTransformer');
      
      expect(config.transformers).toEqual(transformers);
      expect(config.globalTransformer).toBe('globalTransformer');
    });
    
    it('should create an event transformation config without global transformer', () => {
      const transformers = {
        'UserCreated': 'userCreatedTransformer',
        'OrderPlaced': 'orderPlacedTransformer'
      };
      
      const config = createEventTransformationConfig(transformers);
      
      expect(config.transformers).toEqual(transformers);
      expect(config.globalTransformer).toBeUndefined();
    });
  });
  
  describe('Monitoring Configuration', () => {
    it('should create a monitoring config', () => {
      const config = createMonitoringConfig({
        metrics: {
          enabled: true,
          prefix: 'app',
          tags: { environment: 'production' }
        },
        logging: {
          enabled: true,
          level: 'info',
          format: 'json'
        },
        alerting: {
          enabled: true,
          thresholds: { errorRate: 0.05 },
          handlers: ['slackHandler', 'emailHandler']
        }
      });
      
      expect(config.metrics?.enabled).toBe(true);
      expect(config.metrics?.prefix).toBe('app');
      expect(config.metrics?.tags).toEqual({ environment: 'production' });
      
      expect(config.logging?.enabled).toBe(true);
      expect(config.logging?.level).toBe('info');
      expect(config.logging?.format).toBe('json');
      
      expect(config.alerting?.enabled).toBe(true);
      expect(config.alerting?.thresholds).toEqual({ errorRate: 0.05 });
      expect(config.alerting?.handlers).toEqual(['slackHandler', 'emailHandler']);
    });
    
    it('should create a monitoring config with defaults', () => {
      const config = createMonitoringConfig();
      
      expect(config.metrics).toBeUndefined();
      expect(config.logging).toBeUndefined();
      expect(config.alerting).toBeUndefined();
    });
  });
  
  describe('Resilience Configuration', () => {
    it('should create a resilience config with multiple policies', () => {
      const config = createResilienceConfig({
        circuitBreaker: createCircuitBreakerConfig(5, 1000),
        retry: createRetryConfig(3, 'exponential', 100, 5000),
        bulkhead: createBulkheadConfig(10),
        timeout: 30000
      });
      
      expect(config.circuitBreaker).toBeDefined();
      expect(config.circuitBreaker?.failureThreshold).toBe(5);
      
      expect(config.retry).toBeDefined();
      expect(config.retry?.maxAttempts).toBe(3);
      
      expect(config.bulkhead).toBeDefined();
      expect(config.bulkhead?.maxConcurrent).toBe(10);
      
      expect(config.timeout).toBe(30000);
    });
  });
}); 