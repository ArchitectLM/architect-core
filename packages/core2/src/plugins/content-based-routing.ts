import { EventBus } from '../models/event-system';
import { Extension, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';
import { v4 as uuidv4 } from 'uuid';

export interface RouteMatch {
  routeName: string;
  originalEventType: string;
  targetEventType: string;
  timestamp: number;
}

export interface RouteDefinition {
  name: string;
  predicate?: (event: any) => boolean;
  jsonPath?: string;
  expectedValue?: any;
  targetEventType: string;
  transformPayload?: (payload: any) => any;
}

export interface ContentBasedRouter {
  initialize(): void;
  registerRoute(route: RouteDefinition): void;
  registerRouteWithJsonPath(route: Omit<RouteDefinition, 'predicate'> & { jsonPath: string, expectedValue: any }): void;
  updateRoute(route: RouteDefinition): void;
  removeRoute(routeName: string): void;
  getRouteByName(routeName: string): RouteDefinition | undefined;
  getAllRoutes(): RouteDefinition[];
  enableRouteEvents(): void;
  disableRouteEvents(): void;
  getExtension(): Extension;
}

export class ContentBasedRouterImpl implements ContentBasedRouter {
  private routes: Map<string, RouteDefinition> = new Map();
  private initialized = false;
  private emitRouteEvents = false;
  private extension: Extension;
  
  constructor(private eventBus: EventBus) {
    const self = this;
    
    this.extension = {
      id: 'content-based-router',
      name: 'Content Based Router',
      description: 'Routes events based on content matching',
      dependencies: [],
      
      getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
        return [];
      },
      
      getVersion() { return '1.0.0'; },
      
      getCapabilities() { 
        return ['content-based-routing', 'event-transformation'];
      }
    };
  }
  
  initialize(): void {
    if (this.initialized) return;
    
    // Subscribe to all events with a wildcard
    this.eventBus.subscribe('*', this.handleEvent.bind(this));
    
    this.initialized = true;
  }
  
  registerRoute(route: RouteDefinition): void {
    this.routes.set(route.name, route);
  }
  
  registerRouteWithJsonPath(route: Omit<RouteDefinition, 'predicate'> & { jsonPath: string, expectedValue: any }): void {
    // Convert the JSON path route to a predicate-based route
    const predicateRoute: RouteDefinition = {
      name: route.name,
      targetEventType: route.targetEventType,
      transformPayload: route.transformPayload,
      predicate: (event: any) => {
        try {
          return this.evaluateJsonPath(event, route.jsonPath) === route.expectedValue;
        } catch (error) {
          return false;
        }
      }
    };
    
    this.registerRoute(predicateRoute);
  }
  
  updateRoute(route: RouteDefinition): void {
    if (!this.routes.has(route.name)) {
      throw new Error(`Route ${route.name} not found`);
    }
    
    this.routes.set(route.name, route);
  }
  
  removeRoute(routeName: string): void {
    this.routes.delete(routeName);
  }
  
  getRouteByName(routeName: string): RouteDefinition | undefined {
    return this.routes.get(routeName);
  }
  
  getAllRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values());
  }
  
  enableRouteEvents(): void {
    this.emitRouteEvents = true;
  }
  
  disableRouteEvents(): void {
    this.emitRouteEvents = false;
  }
  
  getExtension(): Extension {
    return this.extension;
  }
  
  private handleEvent(event: any): Promise<void> {
    // Skip processing if we're not initialized
    if (!this.initialized) return Promise.resolve();

    // Find all matching routes for this event
    for (const [_, route] of this.routes) {
      let match = false;
      
      if (route.predicate) {
        // Use predicate function to determine if event matches route
        match = route.predicate(event);
      } else if (route.jsonPath && route.expectedValue !== undefined) {
        // Use JSON path expression to evaluate if event matches route
        const value = this.evaluateJsonPath(event, route.jsonPath);
        match = value === route.expectedValue;
      }

      if (match) {
        // Apply payload transformation if defined
        let payload = event.payload;
        if (route.transformPayload) {
          try {
            payload = route.transformPayload(event.payload);
          } catch (error) {
            console.error(`Error transforming payload for route ${route.name}:`, error);
            continue;
          }
        }

        // Publish to the target event type using DomainEvent format
        this.eventBus.publish({
          id: uuidv4(),
          type: route.targetEventType,
          timestamp: Date.now(),
          payload: payload
        });

        // Emit route match event if enabled
        if (this.emitRouteEvents) {
          const routeMatchPayload: RouteMatch = {
            routeName: route.name,
            originalEventType: event.type,
            targetEventType: route.targetEventType,
            timestamp: Date.now()
          };
          
          // Publish route match event using DomainEvent format
          this.eventBus.publish({
            id: uuidv4(),
            type: 'router.route.matched',
            timestamp: Date.now(),
            payload: routeMatchPayload
          });
        }
      }
    }

    return Promise.resolve();
  }
  
  private evaluateJsonPath(obj: any, path: string): any {
    // Simple implementation of JSON Path evaluation
    // Only supports a subset of the full JSON Path spec
    
    // Remove the root indicator if present
    const normalizedPath = path.startsWith('$') ? path.slice(1) : path;
    
    // Split the path into segments
    const segments = normalizedPath.split('.')
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);
    
    // Navigate through the object
    let current = obj;
    
    for (const segment of segments) {
      // Handle array indices or property names with brackets
      if (segment.includes('[') && segment.includes(']')) {
        const [propName, indexStr] = segment.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        
        if (propName) {
          current = current[propName];
        }
        
        if (!isNaN(index) && Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        // Regular property access
        current = current[segment];
      }
      
      // If we hit undefined/null, stop traversing
      if (current === undefined || current === null) {
        return undefined;
      }
    }
    
    return current;
  }
}

export function createContentBasedRouter(eventBus: EventBus): ContentBasedRouter {
  return new ContentBasedRouterImpl(eventBus);
} 