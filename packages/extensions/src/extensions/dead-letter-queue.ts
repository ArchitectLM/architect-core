/**
 * Dead Letter Queue Extension
 * 
 * This extension provides a dead letter queue for handling failed events,
 * with support for retry policies and event replay.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Dead letter queue options
 */
export interface DeadLetterQueueOptions {
  /**
   * Maximum number of retries for failed events
   */
  maxRetries: number;

  /**
   * Maximum size of the queue
   */
  maxSize?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Whether to use exponential backoff for retries
   */
  useExponentialBackoff?: boolean;
}

/**
 * Failed event state
 */
interface FailedEventState {
  event: Event;
  error: Error;
  retryCount: number;
  lastRetryTime: number;
}

/**
 * Dead Letter Queue Extension
 */
export class DeadLetterQueueExtension implements Extension {
  name = 'dead-letter-queue';
  description = 'Provides dead letter queue for handling failed events';

  private options: DeadLetterQueueOptions;
  private queue: Map<string, FailedEventState> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  constructor(options: Partial<DeadLetterQueueOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      maxSize: options.maxSize || 1000,
      retryDelay: options.retryDelay || 5000,
      useExponentialBackoff: options.useExponentialBackoff ?? true
    };
  }

  /**
   * Store a failed event
   */
  storeFailedEvent(event: Event, error: Error): void {
    if (this.queue.size >= (this.options.maxSize || 1000)) {
      throw new Error('Dead letter queue is full');
    }

    const eventId = this.getEventId(event);
    this.queue.set(eventId, {
      event,
      error,
      retryCount: 0,
      lastRetryTime: Date.now()
    });
  }

  /**
   * Replay a failed event
   */
  async replayEvent(eventId: string, eventBus?: { publish: (eventType: string, payload: any) => void }): Promise<void> {
    const state = this.queue.get(eventId);
    if (!state) {
      throw new Error(`Failed event ${eventId} not found`);
    }

    try {
      await eventBus?.publish(state.event.type, state.event);
      this.queue.delete(eventId);
    } catch (error) {
      state.retryCount++;
      state.lastRetryTime = Date.now();
      state.error = error instanceof Error ? error : new Error(String(error));

      if (state.retryCount >= this.options.maxRetries) {
        if (eventBus) {
          eventBus.publish('dlq:exhausted', {
            eventId,
            event: state.event,
            error: state.error,
            retryCount: state.retryCount
          });
        }
        this.queue.delete(eventId);
      } else {
        const delay = this.calculateRetryDelay(state.retryCount);
        const timeout = setTimeout(() => {
          this.replayEvent(eventId, eventBus);
        }, delay);
        this.timeouts.set(eventId, timeout);
      }
    }
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.queue.clear();
  }

  /**
   * Get the current size of the queue
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get a failed event
   */
  getFailedEvent(eventId: string): FailedEventState | undefined {
    return this.queue.get(eventId);
  }

  /**
   * Get all failed events
   */
  getAllFailedEvents(): FailedEventState[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get event ID
   */
  private getEventId(event: Event): string {
    return `${event.type}:${event.id || Date.now()}`;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    if (!this.options.useExponentialBackoff) {
      return this.options.retryDelay || 5000;
    }

    const baseDelay = this.options.retryDelay || 5000;
    return Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000);
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { event, error } = context;

    // Check if this is a failed event
    if (error) {
      this.storeFailedEvent(event, error);
    }

    return context;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.clearQueue();
  }
} 