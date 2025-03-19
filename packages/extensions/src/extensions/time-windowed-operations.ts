/**
 * Time Windowed Operations Extension
 * 
 * This extension provides time-windowed operations on event streams,
 * including tumbling, sliding, session, and count windows.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Window types
 */
export enum WindowType {
  TUMBLING = 'TUMBLING',
  SLIDING = 'SLIDING',
  SESSION = 'SESSION',
  COUNT = 'COUNT'
}

/**
 * Window options
 */
export interface WindowOptions {
  type: WindowType;
  size: number; // milliseconds for time-based windows, count for count windows
  slide?: number; // milliseconds for sliding windows
  timeout?: number; // milliseconds for session windows
}

/**
 * Window state
 */
interface WindowState {
  events: Event[];
  startTime: number;
  endTime: number;
  lastEventTime: number;
}

/**
 * Time Windowed Operations Extension
 */
export class TimeWindowedOperationsExtension implements Extension {
  name = 'time-windowed-operations';
  description = 'Provides time-windowed operations on event streams';

  private windows: Map<string, Map<string, WindowState>> = new Map();
  private options: Map<string, WindowOptions> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  /**
   * Create a new window
   */
  createWindow(windowId: string, options: WindowOptions): void {
    if (this.windows.has(windowId)) {
      throw new Error(`Window ${windowId} already exists`);
    }

    this.options.set(windowId, options);
    this.windows.set(windowId, new Map());

    // Set up cleanup interval
    const cleanupInterval = setInterval(() => {
      this.cleanupWindow(windowId);
    }, options.size);

    this.timeouts.set(windowId, cleanupInterval);
  }

  /**
   * Remove a window
   */
  removeWindow(windowId: string): void {
    const timeout = this.timeouts.get(windowId);
    if (timeout) {
      clearInterval(timeout);
      this.timeouts.delete(windowId);
    }

    this.windows.delete(windowId);
    this.options.delete(windowId);
  }

  /**
   * Process an event
   */
  async processEvent(windowId: string, event: Event, eventBus?: { publish: (eventType: string, payload: any) => void }): Promise<void> {
    const options = this.options.get(windowId);
    if (!options) {
      throw new Error(`Window ${windowId} does not exist`);
    }

    const windowStates = this.windows.get(windowId)!;
    const eventTime = Date.now();

    switch (options.type) {
      case WindowType.TUMBLING:
        await this.processTumblingWindow(windowId, event, eventTime, eventBus);
        break;
      case WindowType.SLIDING:
        await this.processSlidingWindow(windowId, event, eventTime, eventBus);
        break;
      case WindowType.SESSION:
        await this.processSessionWindow(windowId, event, eventTime, eventBus);
        break;
      case WindowType.COUNT:
        await this.processCountWindow(windowId, event, eventBus);
        break;
    }
  }

  /**
   * Process tumbling window
   */
  private async processTumblingWindow(
    windowId: string,
    event: Event,
    eventTime: number,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    const options = this.options.get(windowId)!;
    const windowStates = this.windows.get(windowId)!;
    const windowKey = this.getWindowKey(event, options);
    const windowStart = Math.floor(eventTime / options.size) * options.size;

    let state = windowStates.get(windowKey);
    if (!state || state.startTime !== windowStart) {
      if (state) {
        await this.triggerWindow(windowId, windowKey, state, eventBus);
      }

      state = {
        events: [],
        startTime: windowStart,
        endTime: windowStart + options.size,
        lastEventTime: eventTime
      };
      windowStates.set(windowKey, state);
    }

    state.events.push(event);
    state.lastEventTime = eventTime;
  }

  /**
   * Process sliding window
   */
  private async processSlidingWindow(
    windowId: string,
    event: Event,
    eventTime: number,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    const options = this.options.get(windowId)!;
    const windowStates = this.windows.get(windowId)!;
    const windowKey = this.getWindowKey(event, options);
    const slideSize = options.slide || options.size;

    // Create new windows
    const windowStart = Math.floor(eventTime / slideSize) * slideSize;
    const numWindows = Math.ceil(options.size / slideSize);

    for (let i = 0; i < numWindows; i++) {
      const start = windowStart - (i * slideSize);
      const end = start + options.size;
      const windowId = `${windowKey}:${start}`;

      let state = windowStates.get(windowId);
      if (!state) {
        state = {
          events: [],
          startTime: start,
          endTime: end,
          lastEventTime: eventTime
        };
        windowStates.set(windowId, state);
      }

      state.events.push(event);
      state.lastEventTime = eventTime;
    }

    // Clean up old windows
    await this.cleanupWindow(windowId);
  }

  /**
   * Process session window
   */
  private async processSessionWindow(
    windowId: string,
    event: Event,
    eventTime: number,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    const options = this.options.get(windowId)!;
    const windowStates = this.windows.get(windowId)!;
    const windowKey = this.getWindowKey(event, options);
    const timeout = options.timeout || options.size;

    let state = windowStates.get(windowKey);
    if (!state) {
      state = {
        events: [],
        startTime: eventTime,
        endTime: eventTime + timeout,
        lastEventTime: eventTime
      };
      windowStates.set(windowKey, state);
    } else if (eventTime - state.lastEventTime > timeout) {
      await this.triggerWindow(windowId, windowKey, state, eventBus);
      state = {
        events: [],
        startTime: eventTime,
        endTime: eventTime + timeout,
        lastEventTime: eventTime
      };
      windowStates.set(windowKey, state);
    }

    state.events.push(event);
    state.lastEventTime = eventTime;
    state.endTime = eventTime + timeout;
  }

  /**
   * Process count window
   */
  private async processCountWindow(
    windowId: string,
    event: Event,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    const options = this.options.get(windowId)!;
    const windowStates = this.windows.get(windowId)!;
    const windowKey = this.getWindowKey(event, options);

    let state = windowStates.get(windowKey);
    if (!state) {
      state = {
        events: [],
        startTime: Date.now(),
        endTime: Date.now() + options.size,
        lastEventTime: Date.now()
      };
      windowStates.set(windowKey, state);
    }

    state.events.push(event);
    state.lastEventTime = Date.now();

    if (state.events.length >= options.size) {
      await this.triggerWindow(windowId, windowKey, state, eventBus);
      windowStates.delete(windowKey);
    }
  }

  /**
   * Get window key for an event
   */
  private getWindowKey(event: Event, options: WindowOptions): string {
    // Default to event type as key, can be customized based on needs
    return event.type;
  }

  /**
   * Trigger window processing
   */
  private async triggerWindow(
    windowId: string,
    windowKey: string,
    state: WindowState,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<void> {
    if (eventBus) {
      eventBus.publish('window:triggered', {
        windowId,
        windowKey,
        events: state.events,
        startTime: state.startTime,
        endTime: state.endTime
      });
    }
  }

  /**
   * Clean up expired windows
   */
  private async cleanupWindow(windowId: string): Promise<void> {
    const options = this.options.get(windowId)!;
    const windowStates = this.windows.get(windowId)!;
    const now = Date.now();

    for (const [key, state] of windowStates.entries()) {
      if (now >= state.endTime) {
        await this.triggerWindow(windowId, key, state);
        windowStates.delete(key);
      }
    }
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { event } = context;
    // Process event for all windows
    for (const windowId of this.windows.keys()) {
      await this.processEvent(windowId, event);
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
    this.windows.clear();
    this.options.clear();
  }
} 