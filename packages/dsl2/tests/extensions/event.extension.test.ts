import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';
import { EventEmitter } from 'events';

// Mock the event extension module to test
vi.mock('../../src/extensions/event.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/event.extension.js');
  return {
    ...actual,
    setupEventExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.events) {
        (dsl as any).events = new EventEmitter();
      }
      
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupEventExtension, 
  EventExtensionOptions,
  EventFilter
} from '../../src/extensions/event.extension.js';

describe('Event Extension', () => {
  let dsl: DSL;
  let mockEventHandler: vi.Mock;
  let eventOptions: EventExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    mockEventHandler = vi.fn();
    eventOptions = {
      enableEventHistory: true,
      maxHistoryItems: 100,
      enableFiltering: true
    };
    
    // Setup extension
    setupEventExtension(dsl, eventOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Component Definition', () => {
    it('should allow defining event components with schema references', () => {
      // Define a schema first
      const userSchema = dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });

      // Define an event component
      const userCreatedEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'Event emitted when a user is created',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'user',
        tags: ['user', 'creation']
      });

      expect(userCreatedEvent.id).toBe('UserCreatedEvent');
      expect(userCreatedEvent.type).toBe(ComponentType.EVENT);
      expect(userCreatedEvent.payload).toEqual({ ref: 'UserSchema' });
      expect(userCreatedEvent.stream).toBe('user');
    });
  });

  describe('Event Publishing and Subscription', () => {
    it('should allow publishing and subscribing to events', async () => {
      // Define event schema and component
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      });

      const userEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });

      // The extension should add publishing capabilities
      expect(typeof (userEvent as any).publish).toBe('function');
      
      // Subscribe to the event
      (dsl as any).events.on('event:UserCreatedEvent', mockEventHandler);
      
      // Publish an event
      const eventData = { id: 'user-123', name: 'Test User' };
      await (userEvent as any).publish(eventData);
      
      // Verify the handler was called
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
      expect(mockEventHandler.mock.calls[0][0]).toMatchObject({
        type: 'UserCreatedEvent',
        payload: eventData,
        timestamp: expect.any(Number)
      });
    });
    
    it('should validate event payload against its schema', async () => {
      // Define event schema with validation
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['id', 'name']
      });

      const userEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      // Add validation capability via setupEventExtension
      // This should validate using the schema extension
      
      // Valid payload should work
      const validData = { id: 'user-123', name: 'Test User' };
      await expect((userEvent as any).publish(validData)).resolves.not.toThrow();
      
      // Invalid payload should throw
      const invalidData = { id: 'user-123' }; // Missing required 'name'
      await expect((userEvent as any).publish(invalidData)).rejects.toThrow(/invalid/i);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events based on stream and properties', async () => {
      // Define events
      const userCreatedEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      const userDeletedEvent = dsl.component('UserDeletedEvent', {
        type: ComponentType.EVENT,
        description: 'User deleted event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      // Setup filter
      const filter: EventFilter = {
        streams: ['users'],
        eventTypes: ['UserCreatedEvent'],
        properties: {
          'payload.role': 'admin'
        }
      };
      
      const filteredHandler = vi.fn();
      
      // Register with filter
      (userCreatedEvent as any).subscribeWithFilter(filter, filteredHandler);
      
      // Publish events
      const adminUser = { id: 'user-123', name: 'Admin User', role: 'admin' };
      const regularUser = { id: 'user-456', name: 'Regular User', role: 'user' };
      
      await (userCreatedEvent as any).publish(adminUser);
      await (userCreatedEvent as any).publish(regularUser);
      await (userDeletedEvent as any).publish(adminUser);
      
      // Only events matching the filter should trigger the handler
      expect(filteredHandler).toHaveBeenCalledTimes(1);
      expect(filteredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UserCreatedEvent',
          payload: adminUser
        })
      );
    });
  });

  describe('Event History', () => {
    it('should maintain an event history when enabled', async () => {
      // Define an event
      const userEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      // Publish multiple events
      await (userEvent as any).publish({ id: 'user-1', name: 'User 1' });
      await (userEvent as any).publish({ id: 'user-2', name: 'User 2' });
      await (userEvent as any).publish({ id: 'user-3', name: 'User 3' });
      
      // Get event history
      const history = (userEvent as any).getEventHistory();
      
      // Verify history contains events in order
      expect(history.length).toBe(3);
      expect(history[0].payload.id).toBe('user-1');
      expect(history[1].payload.id).toBe('user-2');
      expect(history[2].payload.id).toBe('user-3');
    });
    
    it('should limit event history size based on configuration', async () => {
      // Create extension with small history limit
      const smallHistoryOptions: EventExtensionOptions = {
        enableEventHistory: true,
        maxHistoryItems: 2
      };
      
      // Re-setup with smaller history
      setupEventExtension(dsl, smallHistoryOptions);
      
      // Define an event
      const userEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      // Publish multiple events (more than the limit)
      await (userEvent as any).publish({ id: 'user-1', name: 'User 1' });
      await (userEvent as any).publish({ id: 'user-2', name: 'User 2' });
      await (userEvent as any).publish({ id: 'user-3', name: 'User 3' });
      
      // Get event history - should only have the most recent events
      const history = (userEvent as any).getEventHistory();
      
      // Verify history is limited to max size
      expect(history.length).toBe(2);
      expect(history[0].payload.id).toBe('user-2');
      expect(history[1].payload.id).toBe('user-3');
    });
  });

  describe('System Integration', () => {
    it('should integrate events with system definitions', () => {
      // Define events and schemas
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { id: { type: 'string' }, name: { type: 'string' } }
      });
      
      dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      dsl.component('UserDeletedEvent', {
        type: ComponentType.EVENT,
        description: 'User deleted event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      // Define a system that uses these events
      const userSystem = dsl.system('UserSystem', {
        description: 'User management system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'UserSchema' }],
          events: [
            { ref: 'UserCreatedEvent' },
            { ref: 'UserDeletedEvent' }
          ]
        }
      });
      
      // The system should have methods to access and publish events
      expect(typeof (userSystem as any).getEvents).toBe('function');
      expect(typeof (userSystem as any).publishEvent).toBe('function');
      
      // Get events from the system
      const events = (userSystem as any).getEvents();
      expect(events.length).toBe(2);
      expect(events[0].id).toBe('UserCreatedEvent');
      expect(events[1].id).toBe('UserDeletedEvent');
    });
  });
}); 