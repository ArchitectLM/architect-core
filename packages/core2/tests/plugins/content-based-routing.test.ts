import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import type { EventBus } from '../../src/models/event-system';
import { 
  ContentBasedRouter, 
  RouteDefinition, 
  RouteMatch,
  createContentBasedRouter 
} from '../../src/plugins/content-based-routing';

interface MockEventBus {
  subscribe: Mock;
  unsubscribe: Mock;
  publish: Mock;
  applyBackpressure: Mock;
}

describe('Content-Based Routing Plugin', () => {
  let eventBus: MockEventBus;
  let router: ContentBasedRouter;

  beforeEach(() => {
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn()
    };

    router = createContentBasedRouter(eventBus as unknown as EventBus);
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
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
      // Create an event that matches the route
      const highPriorityEvent = {
        type: 'original-event',
        payload: { priority: 'high', data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(highPriorityEvent);
      
      // Verify the event was routed with DomainEvent format
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'high-priority-event',
        payload: highPriorityEvent.payload
      }));
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
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
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
      
      // Verify the event was routed with DomainEvent format
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'admin-event',
        payload: adminEvent.payload
      }));
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
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
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
      
      // Verify the event was routed to both targets with DomainEvent format
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'high-priority-event',
        payload: matchingEvent.payload
      }));
      
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'admin-event',
        payload: matchingEvent.payload
      }));
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
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
      // Create a test event
      const originalEvent = {
        type: 'original-event',
        payload: { data: 'test', timestamp: Date.now() },
        timestamp: Date.now()
      };
      
      eventHandler(originalEvent);
      
      // Verify the event was routed with transformed payload
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transformed-event',
          payload: expect.objectContaining({
            data: 'test',
            transformed: true,
            timestamp: 'overridden'
          })
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
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
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
      
      eventHandler(errorEvent);
      eventHandler(normalEvent);
      
      // Verify the events were routed with proper transformations
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conditional-event',
          payload: expect.objectContaining({
            status: 'error',
            message: 'Something went wrong',
            critical: true
          })
        })
      );
      
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conditional-event',
          payload: expect.objectContaining({
            status: 'success',
            message: 'Operation completed',
            routine: true
          })
        })
      );
    });
  });

  describe('Route Filtering', () => {
    it('should handle route filtering', () => {
      router.registerRoute({
        name: 'filtered-route',
        predicate: (event) => event.payload && 'id' in event.payload,
        targetEventType: 'validated-event'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
      // Create valid and invalid events
      const validEvent = {
        type: 'original-event',
        payload: { id: 'abc123', data: 'test' },
        timestamp: Date.now()
      };
      
      const invalidEvent = {
        type: 'original-event',
        payload: { data: 'missing-id' },
        timestamp: Date.now()
      };
      
      eventHandler(validEvent);
      eventHandler(invalidEvent);
      
      // Verify only the valid event was routed
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'validated-event',
        payload: validEvent.payload
      }));
    });
  });

  describe('Route Management', () => {
    it('should find routes by name', () => {
      const routeDefinition: RouteDefinition = {
        name: 'test-route',
        predicate: () => true,
        targetEventType: 'test-target'
      };
      
      router.registerRoute(routeDefinition);
      
      const foundRoute = router.getRouteByName('test-route');
      expect(foundRoute).toEqual(routeDefinition);
    });

    it('should update existing routes', () => {
      // Register initial route
      router.registerRoute({
        name: 'update-test',
        predicate: () => true,
        targetEventType: 'initial-target'
      });
      
      // Update the route
      router.updateRoute({
        name: 'update-test',
        predicate: () => true,
        targetEventType: 'new-target'
      });
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'original-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify the event was routed to the new target
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'new-target',
        payload: testEvent.payload
      }));
    });

    it('should remove routes', () => {
      // Register a route
      router.registerRoute({
        name: 'remove-test',
        predicate: () => true,
        targetEventType: 'test-target'
      });
      
      // Remove the route
      router.removeRoute('remove-test');
      
      // Verify it's gone
      expect(router.getRouteByName('remove-test')).toBeUndefined();
    });

    it('should get all registered routes', () => {
      const routes = [
        {
          name: 'route1',
          predicate: () => true,
          targetEventType: 'target1'
        },
        {
          name: 'route2',
          predicate: () => false,
          targetEventType: 'target2'
        }
      ];
      
      routes.forEach(route => router.registerRoute(route));
      
      const allRoutes = router.getAllRoutes();
      expect(allRoutes).toHaveLength(2);
      expect(allRoutes).toEqual(expect.arrayContaining(routes));
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
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify route match event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'target-event'
        })
      );
      
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'router.route.matched',
          payload: expect.objectContaining({
            routeName: 'route-with-events',
            originalEventType: 'test-event',
            targetEventType: 'target-event'
          })
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
      
      // Disable events
      router.disableRouteEvents();
      
      router.initialize();
      
      // Extract the event handler
      const eventHandler = eventBus.subscribe.mock.calls[0][1];
      
      // Create a test event
      const testEvent = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      eventHandler(testEvent);
      
      // Verify the target event was published but no route match event
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'target-event'
      }));
      expect(eventBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'router.route.matched'
      }));
    });
  });
}); 