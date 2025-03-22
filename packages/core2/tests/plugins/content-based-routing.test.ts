import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/models/event';
import { 
  ContentBasedRouter, 
  RouteDefinition, 
  RouteMatch,
  createContentBasedRouter 
} from '../../src/plugins/content-based-routing';

describe('Content-Based Routing Plugin', () => {
  let eventBus: EventBus;
  let router: ContentBasedRouter;

  beforeEach(() => {
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn()
    };

    router = createContentBasedRouter(eventBus);
  });

  describe('Plugin Initialization', () => {
    it('should subscribe to events on initialization', () => {
      router.initialize();
      expect(eventBus.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
    });
  });

  describe('Route Registration', () => {
    it('should register a route with a predicate', () => {
      const routeDefinition: RouteDefinition = {
        name: 'test-route',
        predicate: (event) => event.payload?.priority === 'high',
        targetEventType: 'high-priority-event'
      };

      router.registerRoute(routeDefinition);
      
      // Verify the route is registered by triggering a matching event
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create an event that matches the route
      const highPriorityEvent = {
        type: 'original-event',
        payload: { priority: 'high', data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(highPriorityEvent);
      
      // Verify the event was routed
      expect(eventBus.publish).toHaveBeenCalledWith('high-priority-event', highPriorityEvent.payload);
    });

    it('should register a route with a JSON path expression', () => {
      router.registerRouteWithJsonPath({
        name: 'json-path-route',
        jsonPath: '$.payload.user.role',
        expectedValue: 'admin',
        targetEventType: 'admin-event'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create an event that matches the route
      const adminEvent = {
        type: 'user-action',
        payload: { 
          user: { 
            id: '123', 
            role: 'admin' 
          }, 
          action: 'delete' 
        },
        timestamp: Date.now()
      };
      
      eventHandler(adminEvent);
      
      // Verify the event was routed
      expect(eventBus.publish).toHaveBeenCalledWith('admin-event', adminEvent.payload);
    });

    it('should handle multiple routes for the same event', () => {
      // Register two routes that could both match the same event
      router.registerRoute({
        name: 'high-priority-route',
        predicate: (event) => event.payload?.priority === 'high',
        targetEventType: 'high-priority-event'
      });
      
      router.registerRoute({
        name: 'admin-route',
        predicate: (event) => event.payload?.user?.role === 'admin',
        targetEventType: 'admin-event'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create an event that matches both routes
      const matchingEvent = {
        type: 'original-event',
        payload: { 
          priority: 'high',
          user: { 
            id: '123', 
            role: 'admin' 
          }
        },
        timestamp: Date.now()
      };
      
      eventHandler(matchingEvent);
      
      // Verify the event was routed to both targets
      expect(eventBus.publish).toHaveBeenCalledWith('high-priority-event', matchingEvent.payload);
      expect(eventBus.publish).toHaveBeenCalledWith('admin-event', matchingEvent.payload);
    });
  });

  describe('Route Transformation', () => {
    it('should transform the payload when routing', () => {
      router.registerRoute({
        name: 'transform-route',
        predicate: () => true,
        targetEventType: 'transformed-event',
        transformPayload: (payload) => ({
          ...payload,
          transformed: true,
          timestamp: 'overridden'
        })
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create a test event
      const originalEvent = {
        type: 'original-event',
        payload: { data: 'test', timestamp: Date.now() },
        timestamp: Date.now()
      };
      
      eventHandler(originalEvent);
      
      // Verify the event was routed with transformed payload
      expect(eventBus.publish).toHaveBeenCalledWith(
        'transformed-event', 
        expect.objectContaining({
          data: 'test',
          transformed: true,
          timestamp: 'overridden'
        })
      );
    });

    it('should apply conditional transformations', () => {
      router.registerRoute({
        name: 'conditional-transform',
        predicate: (event) => true,
        targetEventType: 'conditional-event',
        transformPayload: (payload) => {
          if (payload.status === 'error') {
            return { ...payload, critical: true };
          }
          return { ...payload, routine: true };
        }
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create error and normal events
      const errorEvent = {
        type: 'original-event',
        payload: { status: 'error', message: 'Something went wrong' },
        timestamp: Date.now()
      };
      
      const normalEvent = {
        type: 'original-event',
        payload: { status: 'success', message: 'Operation completed' },
        timestamp: Date.now()
      };
      
      // Process both events
      eventHandler(errorEvent);
      eventHandler(normalEvent);
      
      // Verify the events were routed with proper transformations
      expect(eventBus.publish).toHaveBeenCalledWith(
        'conditional-event', 
        expect.objectContaining({
          status: 'error',
          critical: true
        })
      );
      
      expect(eventBus.publish).toHaveBeenCalledWith(
        'conditional-event', 
        expect.objectContaining({
          status: 'success',
          routine: true
        })
      );
    });
  });

  describe('Route Filtering', () => {
    it('should handle route filtering', () => {
      // Register a route that will reject some events
      router.registerRoute({
        name: 'filtered-route',
        predicate: (event) => {
          // Only accept events with a valid ID
          return typeof event.payload?.id === 'string' && event.payload.id.length > 0;
        },
        targetEventType: 'validated-event'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create valid and invalid events
      const validEvent = {
        type: 'original-event',
        payload: { id: 'abc123', data: 'test' },
        timestamp: Date.now()
      };
      
      const invalidEvent = {
        type: 'original-event',
        payload: { id: '', data: 'test' },
        timestamp: Date.now()
      };
      
      const missingIdEvent = {
        type: 'original-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      // Process all events
      eventHandler(validEvent);
      eventHandler(invalidEvent);
      eventHandler(missingIdEvent);
      
      // Verify only the valid event was routed
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith('validated-event', validEvent.payload);
    });
  });

  describe('Route Management', () => {
    it('should find routes by name', () => {
      const routeDef = {
        name: 'findable-route',
        predicate: () => true,
        targetEventType: 'target-event'
      };
      
      router.registerRoute(routeDef);
      
      const foundRoute = router.getRouteByName('findable-route');
      expect(foundRoute).toEqual(routeDef);
    });

    it('should update existing routes', () => {
      // Register initial route
      router.registerRoute({
        name: 'updateable-route',
        predicate: () => false, // This route initially doesn't match anything
        targetEventType: 'original-target'
      });
      
      // Update the route
      router.updateRoute({
        name: 'updateable-route',
        predicate: () => true, // Now it matches everything
        targetEventType: 'new-target'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify the event was routed to the new target
      expect(eventBus.publish).toHaveBeenCalledWith('new-target', testEvent.payload);
    });

    it('should remove routes', () => {
      // Register a route
      router.registerRoute({
        name: 'removable-route',
        predicate: () => true,
        targetEventType: 'target-event'
      });
      
      // Remove it
      router.removeRoute('removable-route');
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify no routing occurred
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should get all registered routes', () => {
      const routes = [
        {
          name: 'route-1',
          predicate: () => true,
          targetEventType: 'target-1'
        },
        {
          name: 'route-2',
          predicate: () => false,
          targetEventType: 'target-2'
        }
      ];
      
      // Register routes
      routes.forEach(route => router.registerRoute(route));
      
      // Get all routes
      const allRoutes = router.getAllRoutes();
      
      // Verify all routes are returned
      expect(allRoutes).toHaveLength(2);
      expect(allRoutes).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'route-1' }),
        expect.objectContaining({ name: 'route-2' })
      ]));
    });
  });

  describe('Route Events', () => {
    it('should emit route match events', () => {
      router.enableRouteEvents();
      
      router.registerRoute({
        name: 'route-with-events',
        predicate: () => true,
        targetEventType: 'target-event'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify route match event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'router.route.matched',
        expect.objectContaining({
          routeName: 'route-with-events',
          originalEventType: 'test-event',
          targetEventType: 'target-event'
        })
      );
    });

    it('should be able to disable route events', () => {
      router.enableRouteEvents();
      
      router.registerRoute({
        name: 'route-with-events',
        predicate: () => true,
        targetEventType: 'target-event'
      });
      
      router.disableRouteEvents();
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = (eventBus.subscribe as vi.Mock).mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify the target event was published but no route match event
      expect(eventBus.publish).toHaveBeenCalledWith('target-event', expect.anything());
      expect(eventBus.publish).not.toHaveBeenCalledWith('router.route.matched', expect.anything());
    });
  });
}); 