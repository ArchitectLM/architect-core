import { ExtensionPoint, Extension, ExtensionContext, EventInterceptor, ExtensionSystem } from '../models/extension.js';

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
      }
    }
    return result;
  }
}

export function createExtensionSystem(): ExtensionSystem {
  return new ExtensionSystemImpl();
} 