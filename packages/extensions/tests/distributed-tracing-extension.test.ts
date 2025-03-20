import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { DistributedTracingExtension } from '../src/extensions/distributed-tracing.js';
import { Event } from '../src/models.js';

// Extend the Event interface for testing purposes
interface TestEvent extends Event {
  metadata: {
    headers: Record<string, string>;
    tracing?: {
      span: any;
    };
    [key: string]: any;
  };
}

describe('DistributedTracingExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let tracingExtension: DistributedTracingExtension;
  let mockTracer: {
    startSpan: ReturnType<typeof vi.fn>;
    injectContext: ReturnType<typeof vi.fn>;
    extractContext: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock tracer
    mockTracer = {
      startSpan: vi.fn().mockImplementation((name, options) => {
        return {
          name,
          parentContext: options?.parentContext,
          addTags: vi.fn(),
          finish: vi.fn(),
          context: () => ({ spanId: 'test-span-id', traceId: 'test-trace-id' })
        };
      }),
      injectContext: vi.fn().mockImplementation((span, carrier) => {
        carrier['traceparent'] = `00-${span.context().traceId}-${span.context().spanId}-01`;
        return carrier;
      }),
      extractContext: vi.fn().mockImplementation((carrier) => {
        if (carrier['traceparent']) {
          const parts = carrier['traceparent'].split('-');
          return { traceId: parts[1], spanId: parts[2] };
        }
        return null;
      })
    };

    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
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
    
    // Create the tracing extension
    tracingExtension = new DistributedTracingExtension(mockTracer);
    
    // Register the extension
    extensionSystem.registerExtension(tracingExtension);
  });

  describe('GIVEN an incoming event with tracing information', () => {
    it('SHOULD extract the trace context and create a child span', async () => {
      // Create an event with tracing headers
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: {
          headers: {
            traceparent: '00-abcdef0123456789-0123456789abcdef-01'
          }
        }
      };
      
      // WHEN processing the event
      const context = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', context);
      
      // THEN the trace context should be extracted
      expect(mockTracer.extractContext).toHaveBeenCalledWith(event.metadata.headers);
      
      // AND a child span should be created
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'process-event:test-event',
        expect.objectContaining({
          parentContext: expect.anything()
        })
      );
      
      // AND the span should be attached to the event
      expect(event.metadata.tracing).toBeDefined();
      expect(event.metadata.tracing!.span).toBeDefined();
    });
    
    it('SHOULD finish the span after processing', async () => {
      // Create an event with tracing headers
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: {
          headers: {
            traceparent: '00-abcdef0123456789-0123456789abcdef-01'
          }
        }
      };
      
      // Start processing
      const beforeContext = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', beforeContext);
      
      // Get the created span
      const span = event.metadata.tracing!.span;
      expect(span).toBeDefined();
      expect(span.finish).not.toHaveBeenCalled();
      
      // WHEN finishing processing
      const afterContext = { event, result: { success: true } };
      await extensionSystem.triggerExtensionPoint('event.afterProcess', afterContext);
      
      // THEN the span should be finished
      expect(span.finish).toHaveBeenCalled();
      
      // AND the span should have tags for the result
      expect(span.addTags).toHaveBeenCalledWith({
        'event.result': 'success',
        'event.success': true
      });
    });
  });

  describe('GIVEN an incoming event without tracing information', () => {
    it('SHOULD create a new root span', async () => {
      // Create an event without tracing headers
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: { headers: {} }
      };
      
      // WHEN processing the event
      const context = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', context);
      
      // THEN a new root span should be created
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'process-event:test-event',
        expect.not.objectContaining({
          parentContext: expect.anything()
        })
      );
      
      // AND the span should be attached to the event
      expect(event.metadata.tracing).toBeDefined();
      expect(event.metadata.tracing!.span).toBeDefined();
    });
  });

  describe('GIVEN an outgoing event', () => {
    it('SHOULD inject tracing context into the event headers', async () => {
      // Create an event for publishing
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: { headers: {} }
      };
      
      // WHEN publishing the event
      const context = { event };
      await extensionSystem.triggerExtensionPoint('event.beforePublish', context);
      
      // THEN a new span should be created for publishing
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'publish-event:test-event',
        expect.anything()
      );
      
      // AND the tracing context should be injected into the headers
      expect(mockTracer.injectContext).toHaveBeenCalled();
      expect(event.metadata.headers.traceparent).toBeDefined();
      expect(event.metadata.headers.traceparent).toContain('test-trace-id');
    });
    
    it('SHOULD create a child span if parent span exists', async () => {
      // Create an event with an existing span
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: { 
          headers: {},
          tracing: {
            span: {
              name: 'parent-span',
              context: () => ({ spanId: 'parent-span-id', traceId: 'parent-trace-id' }),
              addTags: vi.fn(),
              finish: vi.fn()
            }
          }
        }
      };
      
      // WHEN publishing the event
      const context = { event };
      await extensionSystem.triggerExtensionPoint('event.beforePublish', context);
      
      // THEN a child span should be created
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'publish-event:test-event',
        expect.objectContaining({
          parentContext: expect.anything()
        })
      );
    });
  });

  describe('GIVEN an error during processing', () => {
    it('SHOULD record error information in the span', async () => {
      // Create an event
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: { headers: {} }
      };
      
      // Start processing
      const beforeContext = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', beforeContext);
      
      // Get the created span
      const span = event.metadata.tracing!.span;
      expect(span).toBeDefined();
      
      // WHEN an error occurs during processing
      const error = new Error('Processing failed');
      const afterContext = { event, error };
      await extensionSystem.triggerExtensionPoint('event.afterProcess', afterContext);
      
      // THEN the span should have error tags
      expect(span.addTags).toHaveBeenCalledWith({
        'error': true,
        'error.message': 'Processing failed',
        'event.result': 'error'
      });
      
      // AND the span should be finished
      expect(span.finish).toHaveBeenCalled();
    });
  });

  describe('GIVEN custom span attributes', () => {
    it('SHOULD add custom attributes to spans', async () => {
      // Configure the extension to add custom attributes
      tracingExtension.addGlobalAttribute('service.name', 'test-service');
      tracingExtension.addGlobalAttribute('environment', 'test');
      
      // Create an event
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: { headers: {} }
      };
      
      // WHEN processing the event
      const context = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', context);
      
      // THEN the span should have the custom attributes
      const span = event.metadata.tracing!.span;
      expect(span.addTags).toHaveBeenCalledWith({
        'service.name': 'test-service',
        'environment': 'test',
        'event.name': 'test-event',
        'event.id': expect.any(String)
      });
    });
    
    it('SHOULD add context-specific attributes to spans', async () => {
      // Create an event with context information
      const event: TestEvent = {
        type: 'test-event',
        payload: { data: 'test-data', userId: '123' },
        timestamp: Date.now(),
        metadata: { 
          headers: {},
          tenant: 'test-tenant'
        }
      };
      
      // Configure the extension to extract attributes from context
      tracingExtension.addContextAttributeExtractor((event) => {
        const attributes: Record<string, string> = {};
        
        if (event.payload.userId) {
          attributes['user.id'] = event.payload.userId;
        }
        
        if (event.metadata.tenant) {
          attributes['tenant.id'] = event.metadata.tenant;
        }
        
        return attributes;
      });
      
      // WHEN processing the event
      const context = { event };
      await extensionSystem.triggerExtensionPoint('event.beforeProcess', context);
      
      // THEN the span should have the extracted attributes
      const span = event.metadata.tracing!.span;
      expect(span.addTags).toHaveBeenCalledWith(
        expect.objectContaining({
          'user.id': '123',
          'tenant.id': 'test-tenant'
        })
      );
    });
  });
}); 