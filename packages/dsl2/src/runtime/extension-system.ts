/**
 * Default extension system implementation for the DSL runtime integration
 */
import type { 
  ExtensionSystem, 
  ExtensionContext, 
  Extension, 
  ExtensionPoint,
  EventInterceptor 
} from '@architectlm/core';

/**
 * Simple extension system implementation
 */
class DefaultExtensionSystem implements ExtensionSystem {
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private extensions: Extension[] = [];
  private eventInterceptors: EventInterceptor[] = [];

  /**
   * Register an extension point
   */
  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.name, point);
  }

  /**
   * Register an extension
   */
  registerExtension(extension: Extension): void {
    this.extensions.push(extension);
    
    // Register extension hooks with the appropriate extension points
    Object.entries(extension.hooks).forEach(([pointName, handler]) => {
      const point = this.extensionPoints.get(pointName);
      if (point) {
        point.handlers.push(handler);
      }
    });
  }

  /**
   * Register an event interceptor
   */
  registerEventInterceptor(interceptor: EventInterceptor): void {
    this.eventInterceptors.push(interceptor);
  }

  /**
   * Execute an extension point with the provided context
   */
  async executeExtensionPoint<T extends ExtensionContext>(
    pointName: string, 
    context: T
  ): Promise<T> {
    // Get the extension point
    const point = this.extensionPoints.get(pointName);
    if (!point) {
      return context; // No handlers, return context unchanged
    }

    // Execute all handlers in sequence
    let currentContext = { ...context };
    for (const handler of point.handlers) {
      const result = await Promise.resolve(handler(currentContext));
      currentContext = { ...currentContext, ...result };
    }

    return currentContext as T;
  }

  /**
   * Apply all interceptors to an event
   */
  interceptEvent(event: any): any {
    // Apply all interceptors in sequence
    return this.eventInterceptors.reduce(
      (currentEvent, interceptor) => interceptor(currentEvent),
      event
    );
  }
}

/**
 * Create a default extension system
 */
export function createDefaultExtensionSystem(): ExtensionSystem {
  const system = new DefaultExtensionSystem();
  
  // Register standard extension points
  system.registerExtensionPoint({
    name: 'process:beforeCreate',
    description: 'Executed before creating a process',
    handlers: []
  });
  
  system.registerExtensionPoint({
    name: 'process:beforeTransition',
    description: 'Executed before transitioning a process',
    handlers: []
  });
  
  system.registerExtensionPoint({
    name: 'task:beforeExecution',
    description: 'Executed before executing a task',
    handlers: []
  });
  
  return system;
} 