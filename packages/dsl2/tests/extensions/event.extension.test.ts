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
      expect((userCreatedEvent as any).payload).toEqual({ ref: 'UserSchema' });
      expect((userCreatedEvent as any).stream).toBe('user');
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
      
      // Mock validation function
      (userEvent as any).validatePayload = vi.fn().mockImplementation((payload) => {
        if (!payload.id) {
          return { valid: false, errors: ['ID is required'] };
        }
        if (!payload.name) {
          return { valid: false, errors: ['Name is required'] };
        }
        return { valid: true };
      });
      
      // Valid payload should work
      const validData = { id: 'user-123', name: 'Test User' };
      await (userEvent as any).publish(validData);
      
      // Invalid payload should throw
      const invalidData = { id: 'user-123' }; // Missing required 'name'
      await expect((userEvent as any).publish(invalidData)).rejects.toThrow(/validation/i);
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
      
      // Publish multiple events
      await (userEvent as any).publish({ id: 'user-1', name: 'User 1' });
      await (userEvent as any).publish({ id: 'user-2', name: 'User 2' });
      await (userEvent as any).publish({ id: 'user-3', name: 'User 3' });
      
      // Get history - should only contain last 2 events
      const history = (userEvent as any).getEventHistory();
      expect(history.length).toBe(2);
      expect(history[0].payload.id).toBe('user-2');
      expect(history[1].payload.id).toBe('user-3');
    });
  });

  describe('Event Integration with Tasks', () => {
    it('should trigger events from tasks', async () => {
      // Define schema and event
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      });
      
      const userCreatedEvent = dsl.component('UserCreatedEvent', {
        type: ComponentType.EVENT,
        description: 'User created event',
        version: '1.0.0',
        payload: { ref: 'UserSchema' },
        stream: 'users'
      });
      
      // Create a task that emits events
      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create user task',
        version: '1.0.0',
        input: { type: 'object' },
        output: { ref: 'UserSchema' },
        produces: [
          { event: 'UserCreatedEvent', description: 'Emitted when a user is created' }
        ]
      });
      
      // Mock the event publish function
      const publishMock = vi.fn();
      (userCreatedEvent as any).publish = publishMock;
      
      // Mock the DSL registry to return our event when requested
      (dsl as any).registry.getComponentById = vi.fn().mockImplementation((id) => {
        if (id === 'UserCreatedEvent') return userCreatedEvent;
        return null;
      });
      
      // Implement the task
      const taskImpl = vi.fn().mockImplementation((input, context) => {
        const user = { id: 'user-123', name: input.name };
        
        // Add events to context to be emitted
        context.events = [
          { type: 'UserCreatedEvent', payload: user }
        ];
        
        return user;
      });
      
      dsl.implement('CreateUser', taskImpl);
      
      // Execute the task
      const taskExecutor = vi.fn().mockImplementation(async (input, context) => {
        const result = await taskImpl(input, context);
        
        // Emit events (this is what the task extension would do)
        if (context.events) {
          for (const event of context.events) {
            const eventComponent = (dsl as any).registry.getComponentById(event.type);
            if (eventComponent) {
              await eventComponent.publish(event.payload);
            }
          }
        }
        
        return result;
      });
      
      (createUserTask as any).execute = taskExecutor;
      
      // Call the task
      await (createUserTask as any).execute({ name: 'Test User' }, {});
      
      // Verify event was published
      expect(publishMock).toHaveBeenCalledTimes(1);
      expect(publishMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123', name: 'Test User' }),
        expect.any(Object)
      );
    });
  });
  
  describe('Event Integration with Processes', () => {
    it('should trigger process transitions based on events', async () => {
      // Define an event
      const orderShippedEvent = dsl.component('OrderShippedEvent', {
        type: ComponentType.EVENT,
        description: 'Order shipped event',
        version: '1.0.0',
        payload: { ref: 'OrderSchema' },
        stream: 'orders'
      });
      
      // Define a mock process
      const orderProcess = {
        id: 'OrderProcess',
        type: ComponentType.PROCESS,
        events: {
          'OrderShippedEvent': 'ORDER_SHIPPED'
        },
        handleEvent: vi.fn()
      };
      
      // Mock the process registry
      const processes = new Map();
      processes.set('order-123', {
        processId: 'OrderProcess',
        id: 'order-123',
        currentState: 'processing',
        transition: vi.fn()
      });
      
      (dsl as any).processRegistry = {
        getProcesses: vi.fn().mockReturnValue(processes),
        getProcessDefinition: vi.fn().mockReturnValue(orderProcess)
      };
      
      // Set up event handling
      (orderShippedEvent as any).setupProcessEventHandling = vi.fn().mockImplementation(() => {
        (dsl as any).events.on('event:OrderShippedEvent', (event) => {
          // Get processes that might be interested in this event
          const processes = (dsl as any).processRegistry.getProcesses();
          
          // For each process instance
          for (const [instanceId, instance] of processes.entries()) {
            // Get the process definition
            const processDefinition = (dsl as any).processRegistry.getProcessDefinition(instance.processId);
            
            // If this process handles this event
            if (processDefinition.events && processDefinition.events[event.type]) {
              // Call the process event handler
              processDefinition.handleEvent(instanceId, event);
            }
          }
        });
      });
      
      // Call the setup
      (orderShippedEvent as any).setupProcessEventHandling();
      
      // Emit an event
      const eventData = {
        id: 'order-123',
        status: 'shipped'
      };
      
      await (orderShippedEvent as any).publish(eventData);
      
      // Verify the process event handler was called
      expect(orderProcess.handleEvent).toHaveBeenCalledWith(
        'order-123',
        expect.objectContaining({
          type: 'OrderShippedEvent',
          payload: eventData
        })
      );
    });
  });
}); 