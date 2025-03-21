import { ExtensionSystem, ExtensionPoint, Extension, ExtensionContext, ExtensionHandler, EventInterceptor } from '../models/extension.js';

export class ExtensionSystemImpl implements ExtensionSystem {
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private extensions: Map<string, Extension> = new Map();
  private eventInterceptors: EventInterceptor[] = [];

  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.name, point);
  }

  registerExtension(extension: Extension): void {
    this.extensions.set(extension.name, extension);
  }

  registerEventInterceptor(interceptor: EventInterceptor): void {
    this.eventInterceptors.push(interceptor);
  }

  async executeExtensionPoint<T extends ExtensionContext>(pointName: string, context: T): Promise<T> {
    const point = this.extensionPoints.get(pointName);
    if (!point) {
      return context;
    }

    let result = context;

    // Execute extension point handlers
    for (const handler of point.handlers) {
      try {
        const handlerResult = await handler(result);
        result = handlerResult as T;
      } catch (error) {
        console.error(`Error in extension point handler for ${pointName}:`, error);
        throw error;
      }
    }

    // Execute extension hooks
    for (const extension of this.extensions.values()) {
      const hook = extension.hooks[pointName];
      if (hook) {
        try {
          const hookResult = await hook(result);
          result = hookResult as T;
        } catch (error) {
          console.error(`Error in extension hook for ${extension.name}:`, error);
          throw error;
        }
      }
    }

    return result;
  }

  interceptEvent(event: any): any {
    let result = event;
    for (const interceptor of this.eventInterceptors) {
      try {
        result = interceptor(result);
      } catch (error) {
        console.error('Error in event interceptor:', error);
        throw error;
      }
    }
    return result;
  }

  // Additional utility methods for testing and debugging
  getExtensionPoints(): string[] {
    return Array.from(this.extensionPoints.keys());
  }

  getExtensions(): string[] {
    return Array.from(this.extensions.keys());
  }

  getEventInterceptors(): EventInterceptor[] {
    return [...this.eventInterceptors];
  }

  clear(): void {
    this.extensionPoints.clear();
    this.extensions.clear();
    this.eventInterceptors = [];
  }
}

export function createExtensionSystem(): ExtensionSystem {
  return new ExtensionSystemImpl();
} 