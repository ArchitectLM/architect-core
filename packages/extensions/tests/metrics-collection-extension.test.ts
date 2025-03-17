import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { Event } from '../src/models.js';

// This will be implemented next
import { 
  MetricsCollectionExtension, 
  MetricType, 
  MetricsCollector 
} from '../src/extensions/metrics-collection.js';

describe('MetricsCollectionExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let metricsExtension: MetricsCollectionExtension;
  let mockCollector: MetricsCollector;

  beforeEach(() => {
    // Create mock metrics collector
    mockCollector = {
      recordCounter: vi.fn(),
      recordGauge: vi.fn(),
      recordHistogram: vi.fn(),
      recordSummary: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({
        counters: new Map(),
        gauges: new Map(),
        histograms: new Map(),
        summaries: new Map()
      })
    };

    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'metrics.record',
      description: 'Records a metric',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'metrics.get',
      description: 'Gets current metrics',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.beforeProcess',
      description: 'Called before an event is processed',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.afterProcess',
      description: 'Called after an event is processed',
      handlers: []
    });
    
    // Create the metrics extension
    metricsExtension = new MetricsCollectionExtension(mockCollector);
    
    // Register the extension
    extensionSystem.registerExtension(metricsExtension);
  });

  describe('GIVEN a request to record a counter metric', () => {
    it('SHOULD increment the counter with the specified value', async () => {
      // WHEN recording a counter
      const context = {
        name: 'api.requests',
        type: MetricType.COUNTER,
        value: 1,
        labels: { method: 'GET', path: '/users' }
      };
      
      await extensionSystem.triggerExtensionPoint('metrics.record', context);
      
      // THEN the counter should be recorded
      expect(mockCollector.recordCounter).toHaveBeenCalledWith(
        'api.requests',
        1,
        { method: 'GET', path: '/users' }
      );
    });
  });

  describe('GIVEN a request to record a gauge metric', () => {
    it('SHOULD set the gauge to the specified value', async () => {
      // WHEN recording a gauge
      const context = {
        name: 'system.memory.usage',
        type: MetricType.GAUGE,
        value: 1024,
        labels: { unit: 'MB' }
      };
      
      await extensionSystem.triggerExtensionPoint('metrics.record', context);
      
      // THEN the gauge should be recorded
      expect(mockCollector.recordGauge).toHaveBeenCalledWith(
        'system.memory.usage',
        1024,
        { unit: 'MB' }
      );
    });
  });

  describe('GIVEN a request to record a histogram metric', () => {
    it('SHOULD record the value in the histogram', async () => {
      // WHEN recording a histogram
      const context = {
        name: 'http.response.time',
        type: MetricType.HISTOGRAM,
        value: 42.5,
        labels: { method: 'POST', status: '200' }
      };
      
      await extensionSystem.triggerExtensionPoint('metrics.record', context);
      
      // THEN the histogram should be recorded
      expect(mockCollector.recordHistogram).toHaveBeenCalledWith(
        'http.response.time',
        42.5,
        { method: 'POST', status: '200' }
      );
    });
  });

  describe('GIVEN an event being processed', () => {
    it('SHOULD record processing time metrics', async () => {
      // Setup
      const startTime = Date.now();
      
      // Create an event
      const event: Event = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: startTime,
        metadata: {}
      };
      
      // WHEN processing the event
      const beforeContext = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', beforeContext);
      
      // Simulate processing time
      vi.advanceTimersByTime(100);
      
      const afterContext = { 
        event,
        result: { success: true },
        startTime
      };
      
      await extensionSystem.triggerExtensionPoint('event.afterProcess', afterContext);
      
      // THEN processing time should be recorded
      expect(mockCollector.recordHistogram).toHaveBeenCalledWith(
        'event.processing.time',
        expect.any(Number),
        { eventType: 'test-event', success: 'true' }
      );
      
      // AND event count should be incremented
      expect(mockCollector.recordCounter).toHaveBeenCalledWith(
        'event.processed',
        1,
        { eventType: 'test-event', success: 'true' }
      );
    });
  });

  describe('GIVEN a request to get current metrics', () => {
    it('SHOULD return all collected metrics', async () => {
      // Setup mock metrics
      const mockMetrics = {
        counters: new Map([['test.counter', 5]]),
        gauges: new Map([['test.gauge', 42]]),
        histograms: new Map(),
        summaries: new Map()
      };
      
      mockCollector.getMetrics.mockReturnValue(mockMetrics);
      
      // WHEN requesting metrics
      const result = await extensionSystem.triggerExtensionPoint('metrics.get', {});
      
      // THEN all metrics should be returned
      expect(result).toEqual(mockMetrics);
      expect(mockCollector.getMetrics).toHaveBeenCalled();
    });
  });

  describe('GIVEN a custom metric dimension', () => {
    it('SHOULD allow adding global dimensions to all metrics', async () => {
      // Setup global dimensions
      metricsExtension.addGlobalDimension('environment', 'production');
      metricsExtension.addGlobalDimension('service', 'api-gateway');
      
      // WHEN recording a metric
      const context = {
        name: 'api.latency',
        type: MetricType.HISTOGRAM,
        value: 123,
        labels: { endpoint: '/users' }
      };
      
      await extensionSystem.triggerExtensionPoint('metrics.record', context);
      
      // THEN the metric should include global dimensions
      expect(mockCollector.recordHistogram).toHaveBeenCalledWith(
        'api.latency',
        123,
        { 
          endpoint: '/users',
          environment: 'production',
          service: 'api-gateway'
        }
      );
    });
  });
}); 