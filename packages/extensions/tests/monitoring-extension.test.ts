import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { MonitoringExtension, MetricsCollector } from '../src/extensions/monitoring.js';
import { Event } from '../src/models.js';

describe('MonitoringExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let metricsCollector: MetricsCollector;
  let monitoringExtension: MonitoringExtension;

  beforeEach(() => {
    // Create a mock metrics collector
    metricsCollector = {
      recordCounter: vi.fn(),
      recordGauge: vi.fn(),
      recordHistogram: vi.fn(),
      recordTimer: vi.fn()
    };

    // Use fake timers for testing
    vi.useFakeTimers();

    // Create the monitoring extension with the mock collector
    monitoringExtension = new MonitoringExtension(metricsCollector);

    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.stateChange',
      description: 'Triggered when a circuit breaker changes state'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'retry.attempt',
      description: 'Triggered when a retry is attempted'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'bulkhead.rejected',
      description: 'Triggered when a request is rejected by a bulkhead'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'rateLimit.throttled',
      description: 'Triggered when a request is throttled by a rate limiter'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'cache.access',
      description: 'Triggered when a cache is accessed'
    });

    extensionSystem.registerExtensionPoint({
      name: 'resilience.operationStart',
      description: 'Triggered when a resilient operation starts'
    });

    extensionSystem.registerExtensionPoint({
      name: 'resilience.operationEnd',
      description: 'Triggered when a resilient operation ends'
    });

    extensionSystem.registerExtensionPoint({
      name: 'afterCommandExecution',
      description: 'Triggered after a command is executed'
    });

    extensionSystem.registerExtensionPoint({
      name: 'afterEventProcessing',
      description: 'Triggered after an event is processed'
    });

    extensionSystem.registerExtensionPoint({
      name: 'onError',
      description: 'Triggered when an error occurs'
    });

    
    // Register the monitoring extension
    extensionSystem.registerExtension(monitoringExtension);
    
    // Register the event interceptor
    extensionSystem.registerEventInterceptor(monitoringExtension.eventInterceptor);
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  describe('GIVEN a circuit breaker state change', () => {
    it('SHOULD record metrics about the state change', async () => {
      // WHEN a circuit breaker changes state
      const context = {
        name: 'test-circuit-breaker',
        previousState: 'CLOSED',
        newState: 'OPEN',
        failureCount: 5,
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('circuitBreaker.stateChange', context);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'circuit_breaker.state_change',
        1,
        { name: 'test-circuit-breaker', state: 'OPEN' }
      );
      
      expect(metricsCollector.recordGauge).toHaveBeenCalledWith(
        'circuit_breaker.failure_count',
        5,
        { name: 'test-circuit-breaker' }
      );
    });
  });

  describe('GIVEN a retry attempt', () => {
    it('SHOULD record metrics about the retry', async () => {
      // WHEN a retry is attempted
      const context = {
        name: 'test-retry',
        attemptNumber: 3,
        error: new Error('Test error'),
        delay: 1000,
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('retry.attempt', context);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'retry.attempt',
        1,
        { name: 'test-retry', attempt: '3' }
      );
      
      expect(metricsCollector.recordHistogram).toHaveBeenCalledWith(
        'retry.delay',
        1000,
        { name: 'test-retry' }
      );
    });
  });

  describe('GIVEN a bulkhead rejection', () => {
    it('SHOULD record metrics about the rejection', async () => {
      // WHEN a request is rejected by a bulkhead
      const context = {
        name: 'test-bulkhead',
        activeCount: 10,
        queueSize: 5,
        maxConcurrent: 10,
        maxQueue: 5,
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('bulkhead.rejected', context);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'bulkhead.rejected',
        1,
        { name: 'test-bulkhead' }
      );
      
      expect(metricsCollector.recordGauge).toHaveBeenCalledWith(
        'bulkhead.active_count',
        10,
        { name: 'test-bulkhead' }
      );
      
      expect(metricsCollector.recordGauge).toHaveBeenCalledWith(
        'bulkhead.queue_size',
        5,
        { name: 'test-bulkhead' }
      );
    });
  });

  describe('GIVEN a rate limit throttling', () => {
    it('SHOULD record metrics about the throttling', async () => {
      // WHEN a request is throttled by a rate limiter
      const context = {
        name: 'test-rate-limiter',
        limit: 100,
        currentUsage: 101,
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('rateLimit.throttled', context);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'rate_limiter.throttled',
        1,
        { name: 'test-rate-limiter' }
      );
      
      expect(metricsCollector.recordGauge).toHaveBeenCalledWith(
        'rate_limiter.usage_percentage',
        101,
        { name: 'test-rate-limiter' }
      );
    });
  });

  describe('GIVEN a cache access', () => {
    it('SHOULD record metrics about cache hits', async () => {
      // WHEN a cache is accessed and hits
      const context = {
        name: 'test-cache',
        hit: true,
        key: 'test-key',
        storedAt: Date.now() - 5000,
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('cache.access', context);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'cache.hit',
        1,
        { name: 'test-cache', key: 'test-key' }
      );
      
      expect(metricsCollector.recordHistogram).toHaveBeenCalledWith(
        'cache.age',
        expect.any(Number),
        { name: 'test-cache' }
      );
    });

    it('SHOULD record metrics about cache misses', async () => {
      // WHEN a cache is accessed and misses
      const context = {
        name: 'test-cache',
        hit: false,
        key: 'test-key',
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('cache.access', context);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'cache.miss',
        1,
        { name: 'test-cache', key: 'test-key' }
      );
    });
  });

  describe('GIVEN a resilient operation', () => {
    it('SHOULD record timing metrics for the operation', async () => {
      // WHEN an operation starts
      const startContext = {
        name: 'test-operation',
        timestamp: Date.now()
      };
      
      const modifiedStartContext = await extensionSystem.triggerExtensionPoint('resilience.operationStart', startContext);
      
      // Simulate some time passing
      vi.advanceTimersByTime(100);
      
      // WHEN the operation ends
      const endContext = {
        ...modifiedStartContext,
        success: true,
        result: 'test-result',
        timestamp: Date.now()
      };
      
      await extensionSystem.triggerExtensionPoint('resilience.operationEnd', endContext);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordTimer).toHaveBeenCalledWith(
        'resilience.operation.duration',
        expect.any(Number),
        { name: 'test-operation', success: 'true' }
      );
      
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'resilience.operation.completed',
        1,
        { name: 'test-operation', success: 'true' }
      );
    });
  });

  describe('GIVEN event interception', () => {
    it('SHOULD add timing information to events', () => {
      // WHEN an event is processed
      const event: Event = {
        type: 'test-event',
        payload: { test: 'data' },
        timestamp: Date.now(),
        metadata: {}
      };
      
      const processedEvent = extensionSystem.processEventThroughInterceptors(event);
      
      // THEN timing information should be added
      expect(processedEvent.metadata).toHaveProperty('processedAt');
      expect(typeof processedEvent.metadata.processedAt).toBe('number');
    });

    it('SHOULD record metrics for resilience-related events', () => {
      // WHEN a resilience-related event is processed
      const event: Event = {
        type: 'resilience.retry',
        payload: {
          operation: 'test-operation',
          attempt: 2
        },
        timestamp: Date.now(),
        metadata: {}
      };
      
      extensionSystem.processEventThroughInterceptors(event);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith(
        'event.resilience.retry',
        1,
        { operation: 'test-operation', attempt: '2' }
      );
    });
  });
}); 