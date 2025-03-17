/**
 * Event Correlation Implementation
 * 
 * This module provides an implementation for correlating events based on rules.
 * It supports correlating events by a common key or using a custom matcher function.
 */

import { ReactiveEventBus } from './event-bus.js';
import { Event } from '../models/index.js';

/**
 * Correlation rule interface
 */
export interface CorrelationRule {
  /**
   * Unique identifier for the rule
   */
  id: string;
  
  /**
   * Event types to correlate
   */
  eventTypes: string[];
  
  /**
   * Time window in milliseconds within which events should be correlated
   */
  timeWindow: number;
  
  /**
   * Key to use for correlation (e.g., 'userId', 'orderId')
   * Not required if a custom matcher is provided
   */
  correlationKey?: string;
  
  /**
   * Custom matcher function to determine if events are correlated
   * If provided, this overrides the correlationKey
   */
  matcher?: (events: Event[]) => boolean;
  
  /**
   * Handler function to call when correlated events are detected
   */
  handler: (events: Event[]) => void;
}

/**
 * Internal structure to track event groups
 */
interface EventGroup {
  events: Event[];
  startTime: number;
  lastUpdated: number;
}

/**
 * Event correlation implementation
 */
export class EventCorrelation {
  private eventBus: ReactiveEventBus;
  private rules: Map<string, CorrelationRule> = new Map();
  private eventGroups: Map<string, EventGroup[]> = new Map();
  private subscriptions: Map<string, () => void> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Create a new event correlation handler
   * 
   * @param eventBus The event bus to subscribe to
   */
  constructor(eventBus: ReactiveEventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Add a correlation rule
   * 
   * @param rule The correlation rule to add
   */
  addRule(rule: CorrelationRule): void {
    // Store the rule
    this.rules.set(rule.id, rule);
    
    // Initialize event groups for this rule
    this.eventGroups.set(rule.id, []);
    
    // Subscribe to all event types in the rule
    rule.eventTypes.forEach(eventType => {
      const subscriptionKey = `${rule.id}:${eventType}`;
      
      // Subscribe to the event
      const unsubscribe = this.eventBus.subscribe(eventType, (event: Event) => {
        this.handleEvent(rule.id, event);
      });
      
      // Store the unsubscribe function
      this.subscriptions.set(subscriptionKey, unsubscribe);
    });
    
    // Set up cleanup timer for this rule
    this.setupCleanupTimer(rule.id);
  }
  
  /**
   * Remove a correlation rule
   * 
   * @param ruleId The ID of the rule to remove
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    
    // Unsubscribe from all event types in the rule
    rule.eventTypes.forEach(eventType => {
      const subscriptionKey = `${ruleId}:${eventType}`;
      const unsubscribe = this.subscriptions.get(subscriptionKey);
      if (unsubscribe) {
        unsubscribe();
        this.subscriptions.delete(subscriptionKey);
      }
    });
    
    // Clear the cleanup timer
    const timer = this.cleanupTimers.get(ruleId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(ruleId);
    }
    
    // Remove the rule and its event groups
    this.rules.delete(ruleId);
    this.eventGroups.delete(ruleId);
  }
  
  /**
   * Handle an incoming event
   * 
   * @param ruleId The ID of the rule to apply
   * @param event The event to handle
   */
  private handleEvent(ruleId: string, event: Event): void {
    const rule = this.rules.get(ruleId);
    const groups = this.eventGroups.get(ruleId);
    
    if (!rule || !groups) return;
    
    const now = Date.now();
    
    // If using a correlation key, try to find an existing group with the same key
    if (rule.correlationKey) {
      const correlationValue = event.payload?.[rule.correlationKey];
      
      if (correlationValue !== undefined) {
        // Find an existing group with the same correlation value
        let foundGroup = false;
        
        for (const group of groups) {
          // Skip groups that are too old
          if (now - group.startTime > rule.timeWindow) {
            continue;
          }
          
          // Check if any event in the group has the same correlation value
          const hasMatchingEvent = group.events.some(e => 
            e.payload?.[rule.correlationKey!] === correlationValue
          );
          
          if (hasMatchingEvent) {
            // Add the event to the existing group
            group.events.push(event);
            group.lastUpdated = now;
            foundGroup = true;
            
            // Check if we have all required event types
            this.checkForCorrelation(rule, group);
            break;
          }
        }
        
        // If no matching group was found, create a new one
        if (!foundGroup) {
          groups.push({
            events: [event],
            startTime: now,
            lastUpdated: now
          });
        }
      }
    } else {
      // Without a correlation key, add the event to all active groups
      // and create a new group
      
      // Add to existing groups that are still within the time window
      for (const group of groups) {
        if (now - group.startTime <= rule.timeWindow) {
          group.events.push(event);
          group.lastUpdated = now;
          
          // Check for correlation
          this.checkForCorrelation(rule, group);
        }
      }
      
      // Always create a new group for the event
      groups.push({
        events: [event],
        startTime: now,
        lastUpdated: now
      });
    }
  }
  
  /**
   * Check if a group of events meets the correlation criteria
   * 
   * @param rule The correlation rule to check
   * @param group The group of events to check
   */
  private checkForCorrelation(rule: CorrelationRule, group: EventGroup): void {
    // If using a custom matcher, use that
    if (rule.matcher) {
      if (rule.matcher(group.events)) {
        rule.handler([...group.events]);
      }
      return;
    }
    
    // Otherwise, check if we have all required event types
    const eventTypeSet = new Set<string>();
    
    // Count the unique event types in the group
    for (const event of group.events) {
      eventTypeSet.add(event.type);
    }
    
    // Check if we have all required event types
    const hasAllTypes = rule.eventTypes.every(type => eventTypeSet.has(type));
    
    if (hasAllTypes) {
      // We have all required event types, trigger the handler
      rule.handler([...group.events]);
    }
  }
  
  /**
   * Set up a cleanup timer for a rule
   * 
   * @param ruleId The ID of the rule to clean up
   */
  private setupCleanupTimer(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    
    // Clear any existing timer
    const existingTimer = this.cleanupTimers.get(ruleId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set up a new timer
    const timer = setTimeout(() => {
      this.cleanupExpiredGroups(ruleId);
      this.setupCleanupTimer(ruleId);
    }, rule.timeWindow / 2); // Run cleanup at half the window size for efficiency
    
    this.cleanupTimers.set(ruleId, timer);
  }
  
  /**
   * Clean up expired event groups
   * 
   * @param ruleId The ID of the rule to clean up
   */
  private cleanupExpiredGroups(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    const groups = this.eventGroups.get(ruleId);
    
    if (!rule || !groups) return;
    
    const now = Date.now();
    
    // Filter out groups that are too old
    const activeGroups = groups.filter(group => 
      now - group.startTime <= rule.timeWindow
    );
    
    // Update the groups
    this.eventGroups.set(ruleId, activeGroups);
  }
} 