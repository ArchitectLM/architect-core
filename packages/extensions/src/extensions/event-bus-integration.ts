/**
 * @file Event bus integration with the extension system
 * @module @architectlm/extensions
 */

import { Extension } from '../extension-system.js';
import { Event } from '../models.js';

/**
 * Interface for an event bus that can be integrated with the extension system
 */
export interface EventBus {
  /**
   * Publish an event to the bus
   * @param eventType The type of event
   * @param payload The event payload
   */
  publish<T = any>(eventType: string, payload: T): void;
  
  /**
   * Subscribe to events of a specific type
   * @param eventType The type of event to subscribe to
   * @param handler The event handler
   * @returns A function to unsubscribe
   */
  subscribe(eventType: string, handler: (event: Event) => void): () => void;
}

/**
 * Interface for event bus integration options
 */
export interface EventBusIntegrationOptions {
  /** Whether to process events through interceptors before publishing */
  processInterceptors?: boolean;
  /** Whether to trigger extension points for events */
  triggerExtensionPoints?: boolean;
  /** Mapping of event types to extension points */
  eventTypeToExtensionPoint?: Record<string, string>;
  /** Whether to add event metadata */
  addMetadata?: boolean;
  /** Global metadata to add to all events */
  globalMetadata?: Record<string, any>;
}

/**
 * Extension that integrates the event bus with the extension system
 */
export class EventBusIntegrationExtension implements Extension {
  name = 'event-bus-integration';
  description = 'Integrates the event bus with the extension system';
  
  private eventBus: EventBus;
  private options: EventBusIntegrationOptions;
  private originalPublish: <T>(eventType: string, payload: T) => void;
  
  /**
   * Create a new event bus integration extension
   * @param eventBus The event bus to integrate with
   * @param options Integration options
   */
  constructor(eventBus: EventBus, options: EventBusIntegrationOptions = {}) {
    this.eventBus = eventBus;
    this.options = {
      processInterceptors: true,
      triggerExtensionPoints: true,
      addMetadata: true,
      globalMetadata: {},
      ...options
    };
    
    // Store the original publish method
    this.originalPublish = eventBus.publish;
    
    // Override the publish method
    this.overridePublish();
  }
  
  /**
   * Override the event bus publish method to integrate with the extension system
   */
  private overridePublish(): void {
    const self = this;
    
    // Replace the publish method with our own implementation
    this.eventBus.publish = function<T>(eventType: string, payload: T): void {
      // Create the event object
      const event: Event = {
        type: eventType,
        payload,
        timestamp: Date.now(),
        metadata: self.options.addMetadata ? { ...self.options.globalMetadata } : undefined
      };
      
      // Process the event through hooks
      self.hooks['event.beforePublish']({ event })
        .then(context => {
          // Publish the processed event using the original method
          self.originalPublish.call(self.eventBus, context.event.type, context.event.payload);
          
          // Process after publish
          self.hooks['event.afterPublish']({ 
            event: context.event, 
            result: { success: true } 
          });
        })
        .catch(error => {
          console.error('Error processing event:', error);
          
          // Publish the original event if processing fails
          self.originalPublish.call(self.eventBus, event.type, event.payload);
          
          // Process after publish with error
          self.hooks['event.afterPublish']({ 
            event, 
            result: { success: false, error } 
          });
        });
    };
  }
  
  /**
   * Restore the original publish method when the extension is destroyed
   */
  destroy(): void {
    // Restore the original publish method
    if (this.originalPublish) {
      this.eventBus.publish = this.originalPublish;
    }
  }
  
  hooks = {
    'event.beforePublish': async (context: { event: Event }) => {
      const { event } = context;
      
      // Process through interceptors if enabled
      if (this.options.processInterceptors) {
        try {
          // This will be called by the extension system
          // The event will be processed through all registered interceptors
        } catch (error) {
          console.error('Error processing event through interceptors:', error);
        }
      }
      
      // Trigger extension point for the event type if enabled and mapped
      if (this.options.triggerExtensionPoints && this.options.eventTypeToExtensionPoint) {
        const extensionPoint = this.options.eventTypeToExtensionPoint[event.type];
        
        if (extensionPoint) {
          try {
            // This will be triggered by the extension system
            // The event payload will be passed to the extension point
          } catch (error) {
            console.error(`Error triggering extension point ${extensionPoint}:`, error);
          }
        }
      }
      
      return context;
    },
    
    'event.afterPublish': async (context: { event: Event; result: any }) => {
      // This hook can be used by other extensions to perform actions after an event is published
      return context;
    }
  };
}

/**
 * Create an extended event bus that integrates with the extension system
 * @param eventBus The event bus to extend
 * @param extensionSystem The extension system to integrate with
 * @param options Integration options
 * @returns The extended event bus
 */
export function createExtendedEventBus(
  eventBus: EventBus, 
  extensionSystem: any, 
  options: EventBusIntegrationOptions = {}
): EventBus {
  // Create the integration extension
  const extension = new EventBusIntegrationExtension(eventBus, options);
  
  // Register the extension with the extension system
  extensionSystem.registerExtension(extension);
  
  // Register extension points if they don't exist
  if (!extensionSystem.hasExtensionPoint('event.beforePublish')) {
    extensionSystem.registerExtensionPoint({
      name: 'event.beforePublish',
      description: 'Called before an event is published',
      handlers: []
    });
  }
  
  if (!extensionSystem.hasExtensionPoint('event.afterPublish')) {
    extensionSystem.registerExtensionPoint({
      name: 'event.afterPublish',
      description: 'Called after an event is published',
      handlers: []
    });
  }
  
  // Return the event bus (now with overridden publish method)
  return eventBus;
} 