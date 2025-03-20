import { Extension } from '../extension-system.js';
import { Event } from '@architectlm/core';

/**
 * Interface for a span in a distributed trace
 */
export interface Span {
  /** The name of the span */
  name: string;
  /** Get the context of the span */
  context(): SpanContext;
  /** Add tags to the span */
  addTags(tags: Record<string, any>): void;
  /** Finish the span */
  finish(): void;
}

/**
 * Interface for span context
 */
export interface SpanContext {
  /** The trace ID */
  traceId: string;
  /** The span ID */
  spanId: string;
}

/**
 * Interface for a tracer
 */
export interface Tracer {
  /**
   * Start a new span
   * @param name The name of the span
   * @param options Options for the span
   * @returns The created span
   */
  startSpan(name: string, options?: { parentContext?: SpanContext }): Span;
  
  /**
   * Inject span context into a carrier
   * @param span The span to inject
   * @param carrier The carrier to inject into
   * @returns The carrier with the injected context
   */
  injectContext(span: Span, carrier: Record<string, any>): Record<string, any>;
  
  /**
   * Extract span context from a carrier
   * @param carrier The carrier to extract from
   * @returns The extracted span context or null if not found
   */
  extractContext(carrier: Record<string, any>): SpanContext | null;
}

/**
 * Type for a context attribute extractor function
 */
export type ContextAttributeExtractor = (event: Event) => Record<string, string>;

/**
 * Extension that adds distributed tracing to events
 */
export class DistributedTracingExtension implements Extension {
  name = 'distributed-tracing';
  description = 'Adds distributed tracing to events';
  
  private tracer: Tracer;
  private globalAttributes: Record<string, string> = {};
  private contextAttributeExtractors: ContextAttributeExtractor[] = [];
  
  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }
  
  /**
   * Add a global attribute to all spans
   * @param key The attribute key
   * @param value The attribute value
   */
  addGlobalAttribute(key: string, value: string): void {
    this.globalAttributes[key] = value;
  }
  
  /**
   * Add a context attribute extractor
   * @param extractor The function that extracts attributes from event context
   */
  addContextAttributeExtractor(extractor: ContextAttributeExtractor): void {
    this.contextAttributeExtractors.push(extractor);
  }
  
  /**
   * Extract attributes from an event
   * @param event The event to extract attributes from
   * @returns The extracted attributes
   */
  private extractAttributes(event: Event): Record<string, string> {
    const attributes: Record<string, string> = {
      ...this.globalAttributes,
      'event.name': event.type,
      'event.id': event.id || 'unknown'
    };
    
    // Apply all context attribute extractors
    for (const extractor of this.contextAttributeExtractors) {
      const extractedAttributes = extractor(event);
      Object.assign(attributes, extractedAttributes);
    }
    
    return attributes;
  }
  
  hooks = {
    'event.beforeProcess': (context: { event: Event }) => {
      const { event } = context;
      
      // Ensure event has metadata
      if (!event.metadata) {
        event.metadata = {};
      }
      
      // Ensure event has headers
      if (!event.metadata.headers) {
        event.metadata.headers = {};
      }
      
      // Extract parent context if available
      const parentContext = this.tracer.extractContext(event.metadata.headers);
      
      // Create a span for processing this event
      const span = this.tracer.startSpan(`process-event:${event.type}`, {
        parentContext
      });
      
      // Add attributes to the span
      const attributes = this.extractAttributes(event);
      span.addTags(attributes);
      
      // Attach the span to the event
      if (!event.metadata.tracing) {
        event.metadata.tracing = {};
      }
      event.metadata.tracing.span = span;
      
      return context;
    },
    
    'event.afterProcess': (context: { event: Event; result?: any; error?: Error }) => {
      const { event, result, error } = context;
      
      // Get the span from the event
      const span = event.metadata?.tracing?.span;
      if (!span) {
        return context;
      }
      
      if (error) {
        // Add error information to the span
        span.addTags({
          'error': true,
          'error.message': error.message,
          'event.result': 'error'
        });
      } else if (result) {
        // Add result information to the span
        span.addTags({
          'event.result': 'success',
          'event.success': true
        });
      }
      
      // Finish the span
      span.finish();
      
      return context;
    },
    
    'event.beforePublish': (context: { event: Event }) => {
      const { event } = context;
      
      // Ensure event has metadata
      if (!event.metadata) {
        event.metadata = {};
      }
      
      // Ensure event has headers
      if (!event.metadata.headers) {
        event.metadata.headers = {};
      }
      
      // Get parent context from existing span if available
      const parentContext = event.metadata.tracing?.span?.context();
      
      // Create a span for publishing this event
      const span = this.tracer.startSpan(`publish-event:${event.type}`, {
        parentContext
      });
      
      // Add attributes to the span
      const attributes = this.extractAttributes(event);
      span.addTags(attributes);
      
      // Inject the span context into the event headers
      this.tracer.injectContext(span, event.metadata.headers);
      
      // Attach the span to the event
      if (!event.metadata.tracing) {
        event.metadata.tracing = {};
      }
      event.metadata.tracing.publishSpan = span;
      
      return context;
    },
    
    'event.afterPublish': (context: { event: Event; error?: Error }) => {
      const { event, error } = context;
      
      // Get the publish span from the event
      const span = event.metadata?.tracing?.publishSpan;
      if (!span) {
        return context;
      }
      
      if (error) {
        // Add error information to the span
        span.addTags({
          'error': true,
          'error.message': error.message,
          'event.publish.result': 'error'
        });
      } else {
        // Add success information to the span
        span.addTags({
          'event.publish.result': 'success'
        });
      }
      
      // Finish the span
      span.finish();
      
      return context;
    }
  };
} 