/**
 * Reactive Event Bus
 * 
 * This module provides a simple event bus for reactive systems.
 */

import { Event } from '../types/index';

/**
 * Event handler type
 */
export type EventHandler = (event: Event) => void;

/**
 * Reactive Event Bus
 */
export class ReactiveEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(eventType: string, handler: EventHandler): void {
    if (this.handlers.has(eventType)) {
      this.handlers.get(eventType)!.delete(handler);
    }
  }

  /**
   * Emit an event
   */
  emit(event: Event): void {
    if (this.handlers.has(event.type)) {
      for (const handler of this.handlers.get(event.type)!) {
        handler(event);
      }
    }
  }
}
