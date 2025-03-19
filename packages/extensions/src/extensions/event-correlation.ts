/**
 * Event Correlation Extension
 * 
 * This extension provides event correlation capabilities, allowing events
 * to be grouped and processed together based on matching criteria.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Correlation rule options
 */
export interface CorrelationRuleOptions {
  /**
   * Maximum time window for correlation in milliseconds
   */
  timeout: number;

  /**
   * Maximum number of events to correlate
   */
  maxSize?: number;

  /**
   * Key function to extract correlation key from event
   */
  keyFn?: (event: Event) => string;

  /**
   * Custom matcher function to determine if events should be correlated
   */
  matcher?: (event1: Event, event2: Event) => boolean;
}

/**
 * Correlation state
 */
interface CorrelationState {
  events: Event[];
  startTime: number;
  lastEventTime: number;
}

/**
 * Event Correlation Extension
 */
export class EventCorrelationExtension implements Extension {
  name = 'event-correlation';
  description = 'Provides event correlation capabilities';

  private rules: Map<string, CorrelationRuleOptions> = new Map();
  private correlations: Map<string, Map<string, CorrelationState>> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  /**
   * Add a correlation rule
   */
  addRule(ruleId: string, options: CorrelationRuleOptions): void {
    if (this.rules.has(ruleId)) {
      throw new Error(`Rule ${ruleId} already exists`);
    }

    this.rules.set(ruleId, options);
    this.correlations.set(ruleId, new Map());

    // Set up cleanup interval
    const cleanupInterval = setInterval(() => {
      this.cleanupCorrelations(ruleId);
    }, options.timeout);

    this.timeouts.set(ruleId, cleanupInterval);
  }

  /**
   * Remove a correlation rule
   */
  removeRule(ruleId: string): void {
    const timeout = this.timeouts.get(ruleId);
    if (timeout) {
      clearInterval(timeout);
      this.timeouts.delete(ruleId);
    }

    this.rules.delete(ruleId);
    this.correlations.delete(ruleId);
  }

  /**
   * Process an event
   */
  async processEvent(
    ruleId: string,
    event: Event,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    const options = this.rules.get(ruleId);
    if (!options) {
      throw new Error(`Rule ${ruleId} does not exist`);
    }

    const correlations = this.correlations.get(ruleId)!;
    const correlationKey = this.getCorrelationKey(event, options);
    const now = Date.now();

    let state = correlations.get(correlationKey);
    if (!state) {
      state = {
        events: [],
        startTime: now,
        lastEventTime: now
      };
      correlations.set(correlationKey, state);
    }

    // Check if event should be correlated
    if (state.events.length > 0 && options.matcher) {
      const lastEvent = state.events[state.events.length - 1];
      if (!options.matcher(lastEvent, event)) {
        await this.triggerCorrelation(ruleId, correlationKey, state, eventBus);
        state = {
          events: [],
          startTime: now,
          lastEventTime: now
        };
        correlations.set(correlationKey, state);
      }
    }

    // Add event to correlation
    state.events.push(event);
    state.lastEventTime = now;

    // Check if correlation is complete
    if (options.maxSize && state.events.length >= options.maxSize) {
      await this.triggerCorrelation(ruleId, correlationKey, state, eventBus);
      correlations.delete(correlationKey);
    }
  }

  /**
   * Get correlation key for an event
   */
  private getCorrelationKey(event: Event, options: CorrelationRuleOptions): string {
    if (options.keyFn) {
      return options.keyFn(event);
    }

    // Default to event type as key
    return event.type;
  }

  /**
   * Trigger correlation processing
   */
  private async triggerCorrelation(
    ruleId: string,
    correlationKey: string,
    state: CorrelationState,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    if (eventBus) {
      eventBus.publish('correlation:triggered', {
        ruleId,
        correlationKey,
        events: state.events,
        startTime: state.startTime,
        endTime: state.lastEventTime
      });
    }
  }

  /**
   * Clean up expired correlations
   */
  private async cleanupCorrelations(ruleId: string): Promise<void> {
    const options = this.rules.get(ruleId)!;
    const correlations = this.correlations.get(ruleId)!;
    const now = Date.now();

    for (const [key, state] of correlations.entries()) {
      if (now - state.lastEventTime > options.timeout) {
        await this.triggerCorrelation(ruleId, key, state);
        correlations.delete(key);
      }
    }
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { event } = context;
    // Process event for all rules
    for (const ruleId of this.rules.keys()) {
      await this.processEvent(ruleId, event);
    }
    return context;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    for (const timeout of this.timeouts.values()) {
      clearInterval(timeout);
    }
    this.timeouts.clear();
    this.rules.clear();
    this.correlations.clear();
  }
} 