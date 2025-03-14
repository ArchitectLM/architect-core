/**
 * Event System Types for ArchitectLM
 */
import { z } from 'zod';

/**
 * Event type for the event bus
 */
export interface Event<T extends string = string, P = any> {
  id?: string;                       // Unique event identifier
  type: T;                           // Event type
  payload?: P;                       // Event payload
  timestamp?: Date;                  // Event timestamp (auto-populated if not provided)
  source?: string;                   // Source of the event
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Subscription for event bus
 */
export interface Subscription {
  unsubscribe: () => void;           // Function to unsubscribe
}

/**
 * Event handler function
 */
export type EventHandler<T extends string = string, P = any> = 
  (event: Event<T, P>) => void | Promise<void>; 