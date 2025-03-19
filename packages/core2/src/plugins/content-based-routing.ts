import { EventBus } from '../models/event.js';

export interface RouteMatch {
  routeName: string;
  originalEventType: string;
  targetEventType: string;
  timestamp: number;
}

export interface RouteDefinition {
  name: string;
  predicate: (event: any) => boolean;
  targetEventType: string;
  transformPayload?: (payload: any) => any;
}

export interface JsonPathRouteDefinition {
  name: string;
  jsonPath: string;
  expectedValue: any;
  targetEventType: string;
  transformPayload?: (payload: any) => any;
}

export interface ContentBasedRouter {
  initialize(): void;
  registerRoute(route: RouteDefinition): void;
  registerRouteWithJsonPath(route: JsonPathRouteDefinition): void;
  updateRoute(route: RouteDefinition): void;
  removeRoute(routeName: string): void;
  getRouteByName(routeName: string): RouteDefinition | undefined;
  getAllRoutes(): RouteDefinition[];
  enableRouteEvents(): void;
  disableRouteEvents(): void;
}

export class ContentBasedRouterImpl implements ContentBasedRouter {
  private routes: Map<string, RouteDefinition> = new Map();
  private initialized = false;
  private emitRouteEvents = false;
  
  constructor(private eventBus: EventBus) {}
  
  initialize(): void {
    if (this.initialized) {
      return;
    }
    
    this.eventBus.subscribe('*', this.handleEvent.bind(this));
    this.initialized = true;
  }
  
  registerRoute(route: RouteDefinition): void {
    this.routes.set(route.name, route);
  }
  
  registerRouteWithJsonPath(route: JsonPathRouteDefinition): void {
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
  
  private handleEvent(event: any): void {
    // Check each route to see if the event matches
    for (const route of this.routes.values()) {
      try {
        if (route.predicate(event)) {
          // Transform the payload if a transformer is provided
          const payload = route.transformPayload 
            ? route.transformPayload(event.payload) 
            : event.payload;
          
          // Publish to the target event type
          this.eventBus.publish(route.targetEventType, payload);
          
          // Emit route match event if enabled
          if (this.emitRouteEvents) {
            const routeMatch: RouteMatch = {
              routeName: route.name,
              originalEventType: event.type,
              targetEventType: route.targetEventType,
              timestamp: Date.now()
            };
            
            this.eventBus.publish('router.route.matched', routeMatch);
          }
        }
      } catch (error) {
        // Log the error but continue processing other routes
        console.error(`Error processing route ${route.name}:`, error);
      }
    }
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