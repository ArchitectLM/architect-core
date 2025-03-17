/**
 * Time-Windowed Operations Implementation
 * 
 * This module provides implementations for various time-windowed operations on event streams,
 * including tumbling windows, sliding windows, session windows, and count windows.
 */

import { ReactiveEventBus } from './event-bus.js';
import { Event } from '../models/index.js';

/**
 * Window types
 */
export enum WindowType {
  TUMBLING = 'tumbling',
  SLIDING = 'sliding',
  SESSION = 'session',
  COUNT = 'count'
}

/**
 * Base window options
 */
export interface WindowOptions {
  /**
   * The type of event to window
   */
  eventType: string;
  
  /**
   * Handler function to call when the window is triggered
   */
  handler: (events: Event[]) => void;
}

/**
 * Tumbling window options
 */
export interface TumblingWindowOptions extends WindowOptions {
  /**
   * Window size in milliseconds
   */
  windowSize: number;
}

/**
 * Sliding window options
 */
export interface SlidingWindowOptions extends WindowOptions {
  /**
   * Window size in milliseconds
   */
  windowSize: number;
  
  /**
   * Slide interval in milliseconds
   */
  slideInterval: number;
}

/**
 * Session window options
 */
export interface SessionWindowOptions extends WindowOptions {
  /**
   * Timeout in milliseconds
   */
  timeout: number;
}

/**
 * Count window options
 */
export interface CountWindowOptions extends WindowOptions {
  /**
   * Number of events to collect before triggering
   */
  count: number;
}

/**
 * Time-windowed operations implementation
 */
export class TimeWindowedOperations {
  private eventBus: ReactiveEventBus;
  private windows: Map<string, {
    type: WindowType;
    events: Event[];
    timer?: NodeJS.Timeout;
    options: any;
  }> = new Map();
  
  /**
   * Create a new time-windowed operations handler
   * 
   * @param eventBus The event bus to subscribe to
   */
  constructor(eventBus: ReactiveEventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Create a tumbling window
   * 
   * A tumbling window groups events into fixed-size, non-overlapping time windows.
   * When the window closes, all events in the window are processed together.
   * 
   * @param options Tumbling window options
   * @returns A function to unsubscribe
   */
  tumblingWindow(options: TumblingWindowOptions): () => void {
    const windowId = `tumbling-${options.eventType}-${Date.now()}`;
    
    // Initialize the window
    this.windows.set(windowId, {
      type: WindowType.TUMBLING,
      events: [],
      options
    });
    
    // Start the window timer
    this.startTumblingWindowTimer(windowId);
    
    // Subscribe to events
    const unsubscribe = this.eventBus.subscribe(options.eventType, (event: Event) => {
      const window = this.windows.get(windowId);
      if (window) {
        window.events.push(event);
      }
    });
    
    return () => {
      unsubscribe();
      const window = this.windows.get(windowId);
      if (window && window.timer) {
        clearTimeout(window.timer);
      }
      this.windows.delete(windowId);
    };
  }
  
  /**
   * Create a sliding window
   * 
   * A sliding window groups events into overlapping time windows.
   * Windows are triggered at regular intervals, regardless of event arrival.
   * 
   * @param options Sliding window options
   * @returns A function to unsubscribe
   */
  slidingWindow(options: SlidingWindowOptions): () => void {
    const windowId = `sliding-${options.eventType}-${Date.now()}`;
    
    // Initialize the window
    this.windows.set(windowId, {
      type: WindowType.SLIDING,
      events: [],
      options
    });
    
    // Start the window timer
    this.startSlidingWindowTimer(windowId);
    
    // Subscribe to events
    const unsubscribe = this.eventBus.subscribe(options.eventType, (event: Event) => {
      const window = this.windows.get(windowId);
      if (window) {
        // Add timestamp to the event for sliding window calculations
        const eventWithTimestamp = {
          ...event,
          _timestamp: Date.now()
        };
        window.events.push(eventWithTimestamp as Event);
      }
    });
    
    return () => {
      unsubscribe();
      const window = this.windows.get(windowId);
      if (window && window.timer) {
        clearTimeout(window.timer);
      }
      this.windows.delete(windowId);
    };
  }
  
  /**
   * Create a session window
   * 
   * A session window groups events that arrive within a timeout of each other.
   * The window closes when no events are received for the specified timeout.
   * 
   * @param options Session window options
   * @returns A function to unsubscribe
   */
  sessionWindow(options: SessionWindowOptions): () => void {
    const windowId = `session-${options.eventType}-${Date.now()}`;
    
    // Initialize the window
    this.windows.set(windowId, {
      type: WindowType.SESSION,
      events: [],
      options
    });
    
    // Subscribe to events
    const unsubscribe = this.eventBus.subscribe(options.eventType, (event: Event) => {
      const window = this.windows.get(windowId);
      if (window) {
        // Reset the timer when a new event arrives
        if (window.timer) {
          clearTimeout(window.timer);
        }
        
        // Add the event to the window
        window.events.push(event);
        
        // Start a new timeout
        window.timer = setTimeout(() => {
          this.triggerWindow(windowId);
        }, options.timeout);
      }
    });
    
    return () => {
      unsubscribe();
      const window = this.windows.get(windowId);
      if (window && window.timer) {
        clearTimeout(window.timer);
      }
      this.windows.delete(windowId);
    };
  }
  
  /**
   * Create a count window
   * 
   * A count window groups a fixed number of events together.
   * The window closes when the specified number of events is reached.
   * 
   * @param options Count window options
   * @returns A function to unsubscribe
   */
  countWindow(options: CountWindowOptions): () => void {
    const windowId = `count-${options.eventType}-${Date.now()}`;
    
    // Initialize the window
    this.windows.set(windowId, {
      type: WindowType.COUNT,
      events: [],
      options
    });
    
    // Subscribe to events
    const unsubscribe = this.eventBus.subscribe(options.eventType, (event: Event) => {
      const window = this.windows.get(windowId);
      if (window) {
        // Add the event to the window
        window.events.push(event);
        
        // Check if we've reached the count
        if (window.events.length >= options.count) {
          this.triggerWindow(windowId);
        }
      }
    });
    
    return () => {
      unsubscribe();
      this.windows.delete(windowId);
    };
  }
  
  /**
   * Start a tumbling window timer
   * 
   * @param windowId The window ID
   */
  private startTumblingWindowTimer(windowId: string): void {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    const { windowSize } = window.options as TumblingWindowOptions;
    
    window.timer = setTimeout(() => {
      this.triggerWindow(windowId);
      
      // Start a new window
      this.startTumblingWindowTimer(windowId);
    }, windowSize);
  }
  
  /**
   * Start a sliding window timer
   * 
   * @param windowId The window ID
   */
  private startSlidingWindowTimer(windowId: string): void {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    const { slideInterval, windowSize } = window.options as SlidingWindowOptions;
    
    window.timer = setTimeout(() => {
      // Get the current time
      const now = Date.now();
      
      // Filter events to only include those within the window
      const windowStart = now - windowSize;
      
      // Trigger the window with events in the time range
      this.triggerWindowWithTimeRange(windowId, windowStart, now);
      
      // Start a new timer for the next slide
      this.startSlidingWindowTimer(windowId);
    }, slideInterval);
  }
  
  /**
   * Trigger a window with events in a time range
   * 
   * @param windowId The window ID
   * @param startTime The start time of the range
   * @param endTime The end time of the range
   */
  private triggerWindowWithTimeRange(windowId: string, startTime: number, endTime: number): void {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    // Filter events to only include those within the time range
    const eventsInWindow = window.events.filter((event: any) => {
      const timestamp = event._timestamp || 0;
      return timestamp >= startTime && timestamp <= endTime;
    });
    
    // Remove events that are outside the window (older than startTime)
    window.events = window.events.filter((event: any) => {
      const timestamp = event._timestamp || 0;
      return timestamp >= startTime;
    });
    
    // Call the handler with the events in the window
    window.options.handler(eventsInWindow);
  }
  
  /**
   * Trigger a window
   * 
   * @param windowId The window ID
   */
  private triggerWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    // Call the handler with all events in the window
    window.options.handler([...window.events]);
    
    // Clear the events for the window
    window.events = [];
  }
} 