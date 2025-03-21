import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, Event, EventFilter, EventStorage, ReactiveRuntime, ExtensionSystemImpl, EventBusImpl, InMemoryEventStorage } from '../src/index.js';

// Create an in-memory event storage implementation for testing
class TestEventStorage extends InMemoryEventStorage {
  async saveEvent(event: Event): Promise<void> {
    await super.saveEvent(event);
  }

  async getEvents(filter: EventFilter): Promise<Event[]> {
    return super.getEvents(filter);
  }

  async getEventById(eventId: string): Promise<Event | undefined> {
    return super.getEventById(eventId);
  }

  async getEventsByCorrelationId(correlationId: string): Promise<Event[]> {
    return super.getEventsByCorrelationId(correlationId);
  }
}

describe('Event Persistence and Correlation', () => {
  let runtime: Runtime;
  let eventBus: EventBusImpl;
  let storage: TestEventStorage;
  let extensionSystem: ExtensionSystemImpl;

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    storage = new TestEventStorage();
    
    runtime = new ReactiveRuntime({}, {}, {
      extensionSystem,
      eventBus,
      eventStorage: storage
    });
  });

  describe('Event Persistence', () => {
    it('should persist events when published', async () => {
      // Publish some events
      runtime.publish('test-event', { data: 'test1' });
      runtime.publish('test-event', { data: 'test2' });
      runtime.publish('other-event', { data: 'test3' });
      
      // Check persisted events
      const events = await storage.getEvents({});
      expect(events.length).toBe(3);
      expect(events.filter(e => e.type === 'test-event').length).toBe(2);
      expect(events.filter(e => e.type === 'other-event').length).toBe(1);
    });

    it('should not persist events when persistence is disabled', async () => {
      // Enable persistence
      runtime.publish('test-event', { data: 'test1' });
      
      // Disable persistence
      eventBus.disablePersistence();
      runtime.publish('test-event', { data: 'test2' });
      
      // Check persisted events
      const events = await storage.getEvents({});
      expect(events.length).toBe(1);
      expect(events[0].payload.data).toBe('test1');
    });
  });

  describe('Event Correlation', () => {
    it('should correlate events by correlation ID', async () => {
      const correlationId = 'test-correlation-id';
      
      // Publish correlated events
      runtime.publish('event1', { data: 'test1', correlationId });
      runtime.publish('event2', { data: 'test2', correlationId });
      runtime.publish('event3', { data: 'test3' }); // No correlation ID
      
      // Get correlated events
      const correlatedEvents = await runtime.correlateEvents(correlationId);
      expect(correlatedEvents.length).toBe(2);
      expect(correlatedEvents.map(e => e.type)).toContain('event1');
      expect(correlatedEvents.map(e => e.type)).toContain('event2');
    });

    it('should support causation chains', async () => {
      // Create a chain of events where each event causes the next
      const rootEvent = await publishAndGetEvent('root-event', { data: 'root' });
      
      const childEvent = await publishAndGetEvent('child-event', { 
        data: 'child',
        causationId: rootEvent.id,
        correlationId: rootEvent.correlationId 
      });
      
      const grandchildEvent = await publishAndGetEvent('grandchild-event', { 
        data: 'grandchild',
        causationId: childEvent.id,
        correlationId: rootEvent.correlationId 
      });
      
      // Get all events in the correlation
      const correlatedEvents = await runtime.correlateEvents(rootEvent.correlationId!);
      expect(correlatedEvents.length).toBe(3);
      
      // Validate causation chain
      const root = correlatedEvents.find(e => e.type === 'root-event');
      const child = correlatedEvents.find(e => e.type === 'child-event');
      const grandchild = correlatedEvents.find(e => e.type === 'grandchild-event');
      
      expect(root?.causationId).toBeUndefined();
      expect(child?.causationId).toBe(root?.id);
      expect(grandchild?.causationId).toBe(child?.id);
    });
    
    // Helper to publish an event and get the persisted version
    async function publishAndGetEvent(type: string, payload: any): Promise<Event> {
      runtime.publish(type, payload);
      const events = await storage.getEvents({ types: [type] });
      return events[events.length - 1];
    }
  });

  describe('Event Replay', () => {
    it('should replay events based on a filter', async () => {
      // Publish some events with different timestamps
      const now = Date.now();
      
      // These events will be in the replay window
      runtime.publish('test-event', { 
        value: 1,
        metadata: { timestamp: now - 5000 } 
      });
      runtime.publish('test-event', { 
        value: 2,
        metadata: { timestamp: now - 3000 } 
      });
      runtime.publish('other-event', { 
        value: 3,
        metadata: { timestamp: now - 4000 } 
      });
      
      // This event will be outside the replay window
      runtime.publish('test-event', { 
        value: 4,
        metadata: { timestamp: now - 6000 } 
      });
      
      // Setup handler to collect replayed events
      const replayedEvents: Event[] = [];
      const unsubscribe = runtime.subscribe('test-event', event => {
        if (event.metadata?.isReplay) {
          replayedEvents.push(event);
        }
      });
      
      // Replay events in a specific time window
      await runtime.replayEvents(now - 5500, now - 2500, ['test-event']);
      
      unsubscribe();
      
      // Check that only the right events were replayed
      expect(replayedEvents.length).toBe(2);
      expect(replayedEvents[0].payload.value).toBe(1);
      expect(replayedEvents[1].payload.value).toBe(2);
      expect(replayedEvents.every(e => e.metadata?.isReplay)).toBe(true);
    });

    it('should emit replay start and complete events', async () => {
      // Publish an event to replay
      runtime.publish('test-event', { data: 'test' });
      
      // Setup handlers to detect replay events
      const replayEvents: Event[] = [];
      const unsubscribe = runtime.subscribe('replay:*', event => {
        replayEvents.push(event);
      });
      
      // Replay all events
      await runtime.replayEvents(0, Date.now());
      
      unsubscribe();
      
      // Check replay events
      expect(replayEvents.length).toBe(2);
      expect(replayEvents[0].type).toBe('replay:started');
      expect(replayEvents[1].type).toBe('replay:completed');
    });
  });

  describe('Event Routing and Filtering', () => {
    it('should route events to additional channels', async () => {
      // Setup router to send user events to a user-specific channel
      eventBus.addEventRouter(event => {
        if (event.type === 'user-action' && event.payload.userId) {
          return [`user-${event.payload.userId}`];
        }
        return [];
      });
      
      // Setup handlers for both channels
      const userActionEvents: Event[] = [];
      const userSpecificEvents: Event[] = [];
      
      const unsubscribe1 = runtime.subscribe('user-action', event => {
        userActionEvents.push(event);
      });
      
      const unsubscribe2 = runtime.subscribe('user-123', event => {
        userSpecificEvents.push(event);
      });
      
      // Publish a user action event
      runtime.publish('user-action', { 
        userId: '123',
        action: 'login'
      });
      
      unsubscribe1();
      unsubscribe2();
      
      // Check that the event was routed to both channels
      expect(userActionEvents.length).toBe(1);
      expect(userSpecificEvents.length).toBe(1);
      expect(userActionEvents[0].payload.userId).toBe('123');
      expect(userSpecificEvents[0].payload.userId).toBe('123');
    });
  });
}); 