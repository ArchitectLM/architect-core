/**
 * Dead Letter Queue Implementation
 * 
 * This module provides an implementation of a Dead Letter Queue (DLQ) for handling failed events.
 * The DLQ stores events that failed processing along with their errors, allowing for later replay.
 */

import { ReactiveEventBus } from './event-bus.js';
import { Event } from '../models/index.js';

/**
 * Interface for a queued event in the DLQ
 */
export interface QueuedEvent {
  event: Event;
  error: Error;
  timestamp: number;
  retryCount: number;
}

/**
 * Dead Letter Queue implementation
 */
export class DeadLetterQueue {
  private eventBus: ReactiveEventBus;
  private queue: QueuedEvent[] = [];

  /**
   * Create a new Dead Letter Queue
   * 
   * @param eventBus The event bus to use for replaying events
   */
  constructor(eventBus: ReactiveEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Add a failed event to the queue
   * 
   * @param event The event that failed processing
   * @param error The error that occurred during processing
   * @param retryCount The number of times the event has been retried (default: 0)
   */
  addFailedEvent(event: Event, error: Error, retryCount = 0): void {
    this.queue.push({
      event,
      error,
      timestamp: Date.now(),
      retryCount
    });
  }

  /**
   * Get all queued events
   * 
   * @returns Array of queued events
   */
  getQueuedEvents(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Replay a specific event from the queue
   * 
   * @param index The index of the event to replay
   * @throws Error if the index is invalid
   */
  async replayEvent(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) {
      throw new Error('Invalid event index');
    }

    const queuedEvent = this.queue[index];
    this.eventBus.publish(queuedEvent.event.type, queuedEvent.event.payload);
    
    // Remove the event from the queue
    this.queue.splice(index, 1);
  }

  /**
   * Replay all events in the queue
   */
  async replayAllEvents(): Promise<void> {
    // Create a copy of the queue to avoid issues with modifying while iterating
    const eventsToReplay = [...this.queue];
    
    // Clear the queue
    this.clearQueue();
    
    // Replay each event
    for (const queuedEvent of eventsToReplay) {
      this.eventBus.publish(queuedEvent.event.type, queuedEvent.event.payload);
    }
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Subscribe to an event with DLQ error handling
   * 
   * @param eventType The type of event to subscribe to
   * @param handler The event handler function
   * @returns A function to unsubscribe
   */
  subscribeWithDLQ(eventType: string, handler: (event: Event) => void): () => void {
    return this.eventBus.subscribe(eventType, (event: Event) => {
      try {
        handler(event);
      } catch (error) {
        // Add the failed event to the queue
        this.addFailedEvent(event, error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
} 