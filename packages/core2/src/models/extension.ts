export interface ExtensionPoint {
  name: string;
  description: string;
  handlers: ExtensionHandler[];
}

export interface Extension {
  name: string;
  description: string;
  hooks: Record<string, ExtensionHandler>;
}

export interface ExtensionContext {
  [key: string]: any;
}

export type ExtensionHandler = (context: ExtensionContext) => Promise<ExtensionContext> | ExtensionContext;

export type EventInterceptor = (event: any) => any;

export interface ExtensionSystem {
  registerExtensionPoint(point: ExtensionPoint): void;
  registerExtension(extension: Extension): void;
  registerEventInterceptor(interceptor: EventInterceptor): void;
  executeExtensionPoint<T extends ExtensionContext>(pointName: string, context: T): Promise<T>;
  interceptEvent(event: any): any;
} 