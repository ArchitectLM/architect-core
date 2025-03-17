/**
 * Event Transformation Extension
 * 
 * This extension provides functionality to transform events as they flow through the system.
 * It allows for both global transformations that apply to all events and specific transformations
 * for particular event types.
 */

import { Extension } from '../extension-system.js';

/**
 * Event interface
 */
export interface Event {
  type: string;
  payload: any;
  timestamp: number;
  [key: string]: any;
}

/**
 * Configuration options for the event transformation extension
 */
export interface EventTransformationOptions {
  /**
   * Map of event types to transformer functions
   * Each transformer receives the event and returns a transformed event
   */
  transformers?: Record<string, (event: Event) => Event>;
  
  /**
   * Global transformer that applies to all events
   * Runs after any type-specific transformers
   */
  globalTransformer?: (event: Event) => Event;
}

/**
 * Context for event transformation
 */
export interface EventTransformationContext {
  /**
   * The original event before transformation
   */
  originalEvent: Event;
  
  /**
   * The transformed event
   */
  transformedEvent: Event;
  
  /**
   * The transformer that was applied, if any
   */
  transformer?: string;
  
  /**
   * Optional metadata for the context
   */
  metadata?: Record<string, unknown>;
}

/**
 * Event Transformation Extension
 * 
 * Provides capabilities to transform events as they flow through the system.
 */
export class EventTransformationExtension implements Extension {
  name: string = "event-transformation";
  description: string = "Transforms events as they flow through the system";
  hooks: Record<string, (context: unknown) => unknown> = {};
  metadata?: Record<string, unknown>;
  
  private options: EventTransformationOptions;
  private transformers: Map<string, (event: Event) => Event> = new Map();
  private globalTransformer?: (event: Event) => Event;

  constructor(options: EventTransformationOptions = {}) {
    this.options = options;
    
    // Initialize transformers
    if (options.transformers) {
      for (const [eventType, transformer] of Object.entries(options.transformers)) {
        this.transformers.set(eventType, transformer);
      }
    }
    
    this.globalTransformer = options.globalTransformer;
    
    // Register hooks
    this.hooks["beforeEventProcessing"] = this.transformEvent.bind(this);
  }

  /**
   * Register a transformer for a specific event type
   */
  registerTransformer(eventType: string, transformer: (event: Event) => Event): void {
    this.transformers.set(eventType, transformer);
  }

  /**
   * Register a global transformer that applies to all events
   */
  registerGlobalTransformer(transformer: (event: Event) => Event): void {
    this.globalTransformer = transformer;
  }

  /**
   * Transform an event (hook implementation)
   */
  private transformEvent(context: unknown): unknown {
    const event = context as Event;
    return this.transform(event);
  }

  /**
   * Transform an event
   */
  transform(event: Event): Event {
    let transformedEvent = { ...event };
    let transformerName: string | undefined;
    
    // Apply type-specific transformer if available
    if (this.transformers.has(event.type)) {
      const transformer = this.transformers.get(event.type)!;
      transformedEvent = transformer(transformedEvent);
      transformerName = event.type;
    }
    
    // Apply global transformer if available
    if (this.globalTransformer) {
      transformedEvent = this.globalTransformer(transformedEvent);
      transformerName = transformerName ? `${transformerName}+global` : 'global';
    }
    
    // Create transformation context
    const context: EventTransformationContext = {
      originalEvent: event,
      transformedEvent,
      transformer: transformerName,
      metadata: {}
    };
    
    return transformedEvent;
  }

  /**
   * Create a new event transformation extension
   */
  static create(options: EventTransformationOptions = {}): EventTransformationExtension {
    return new EventTransformationExtension(options);
  }
}

/**
 * Create a new event transformation extension
 */
export function createEventTransformation(options: EventTransformationOptions = {}): EventTransformationExtension {
  return EventTransformationExtension.create(options);
}