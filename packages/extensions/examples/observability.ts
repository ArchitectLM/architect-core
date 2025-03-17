/**
 * @file Example of comprehensive observability with metrics and tracing
 * @module @architectlm/extensions/examples
 */

import { DefaultExtensionSystem } from '../src/extension-system.js';
import { 
  MetricsCollectionExtension, 
  MetricType, 
  DefaultMetricsCollector 
} from '../src/extensions/metrics-collection.js';
import { 
  DistributedTracingExtension, 
  Tracer, 
  Span, 
  SpanContext 
} from '../src/extensions/distributed-tracing.js';
import { Event } from '../src/models.js';

/**
 * Create a simple console tracer for demonstration
 */
function createConsoleTracer(): Tracer {
  return {
    startSpan(name, options) {
      console.log(`[TRACE] Starting span: ${name}${options?.parentContext ? ' (child)' : ''}`);
      
      const spanId = Math.random().toString(36).substring(2, 10);
      const traceId = options?.parentContext?.traceId || 
                      Math.random().toString(36).substring(2, 18);
      
      const span: Span = {
        name,
        context: () => ({ spanId, traceId }),
        addTags(tags) {
          console.log(`[TRACE] Adding tags to span ${name}:`, tags);
        },
        finish() {
          console.log(`[TRACE] Finishing span: ${name}`);
        }
      };
      
      return span;
    },
    
    injectContext(span, carrier) {
      const context = span.context();
      carrier['traceparent'] = `00-${context.traceId}-${context.spanId}-01`;
      return carrier;
    },
    
    extractContext(carrier) {
      if (carrier['traceparent']) {
        const parts = carrier['traceparent'].split('-');
        return { traceId: parts[1], spanId: parts[2] };
      }
      return null;
    }
  };
}

/**
 * Create a metrics reporter that logs to console
 */
function createMetricsReporter(collector: DefaultMetricsCollector) {
  return {
    reportMetrics() {
      const metrics = collector.getMetrics();
      
      console.log('\n=== METRICS REPORT ===');
      
      console.log('\nCounters:');
      metrics.counters.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
      
      console.log('\nGauges:');
      metrics.gauges.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
      
      console.log('\nHistograms:');
      metrics.histograms.forEach((values, key) => {
        if (values.length > 0) {
          const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          console.log(`  ${key}: count=${values.length}, avg=${avg.toFixed(2)}, min=${min}, max=${max}`);
        }
      });
      
      console.log('\n=====================\n');
    }
  };
}

/**
 * Create and configure the extension system for observability
 */
function createObservabilityExtensionSystem(): {
  extensionSystem: DefaultExtensionSystem;
  metricsCollector: DefaultMetricsCollector;
  reporter: { reportMetrics: () => void };
} {
  const extensionSystem = new DefaultExtensionSystem();
  
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
  
  extensionSystem.registerExtensionPoint({
    name: 'event.beforePublish',
    description: 'Called before an event is published',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'event.afterPublish',
    description: 'Called after an event is published',
    handlers: []
  });
  
  // Create the metrics collector and extension
  const metricsCollector = new DefaultMetricsCollector();
  const metricsExtension = new MetricsCollectionExtension(metricsCollector);
  
  // Add global dimensions
  metricsExtension.addGlobalDimension('service', 'example-service');
  metricsExtension.addGlobalDimension('environment', 'development');
  
  // Create the tracing extension
  const tracingExtension = new DistributedTracingExtension(createConsoleTracer());
  
  // Add global attributes
  tracingExtension.addGlobalAttribute('service', 'example-service');
  
  // Register the extensions
  extensionSystem.registerExtension(metricsExtension);
  extensionSystem.registerExtension(tracingExtension);
  
  // Create a metrics reporter
  const reporter = createMetricsReporter(metricsCollector);
  
  return { extensionSystem, metricsCollector, reporter };
}

/**
 * Simulate processing an event with observability
 */
async function processEvent(extensionSystem: DefaultExtensionSystem, event: Event): Promise<any> {
  // Before processing
  const beforeContext = { event };
  await extensionSystem.triggerExtensionPoint('event.beforeProcess', beforeContext);
  
  // Simulate processing time
  const processingTime = Math.random() * 100 + 50;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  // Record a custom metric
  await extensionSystem.triggerExtensionPoint('metrics.record', {
    name: 'custom.processing.time',
    type: MetricType.HISTOGRAM,
    value: processingTime,
    labels: { eventType: event.type }
  });
  
  // Simulate result
  const result = { 
    success: Math.random() > 0.2, // 80% success rate
    data: `Processed ${event.type} event`
  };
  
  // After processing
  const afterContext = { event, result };
  await extensionSystem.triggerExtensionPoint('event.afterProcess', afterContext);
  
  return result;
}

/**
 * Simulate publishing an event with observability
 */
async function publishEvent(extensionSystem: DefaultExtensionSystem, event: Event): Promise<void> {
  // Before publishing
  const beforeContext = { event };
  await extensionSystem.triggerExtensionPoint('event.beforePublish', beforeContext);
  
  // Simulate publishing time
  const publishingTime = Math.random() * 30 + 10;
  await new Promise(resolve => setTimeout(resolve, publishingTime));
  
  // Record a custom metric
  await extensionSystem.triggerExtensionPoint('metrics.record', {
    name: 'custom.publishing.time',
    type: MetricType.HISTOGRAM,
    value: publishingTime,
    labels: { eventType: event.type }
  });
  
  // After publishing
  const afterContext = { event, result: { success: true } };
  await extensionSystem.triggerExtensionPoint('event.afterPublish', afterContext);
  
  console.log(`Published event: ${event.type}`);
}

/**
 * Example usage
 */
async function example() {
  const { extensionSystem, reporter } = createObservabilityExtensionSystem();
  
  // Process a batch of events
  const eventTypes = ['user.created', 'order.placed', 'payment.processed', 'email.sent'];
  
  for (let i = 0; i < 10; i++) {
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    // Create an event
    const event: Event = {
      type: eventType,
      payload: { id: `event-${i}`, timestamp: Date.now() },
      timestamp: Date.now(),
      metadata: {
        headers: {}
      }
    };
    
    // Process the event
    const result = await processEvent(extensionSystem, event);
    
    // If successful, publish a follow-up event
    if (result.success) {
      const followUpEvent: Event = {
        type: `${eventType}.processed`,
        payload: { originalId: `event-${i}`, result },
        timestamp: Date.now(),
        metadata: {
          headers: {}
        }
      };
      
      await publishEvent(extensionSystem, followUpEvent);
    }
  }
  
  // Report metrics
  reporter.reportMetrics();
}

// Export the example and utility functions
export {
  createObservabilityExtensionSystem,
  processEvent,
  publishEvent,
  example
}; 