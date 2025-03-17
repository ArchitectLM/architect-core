/**
 * External System Adapter
 * 
 * This module provides functionality to integrate with external systems like databases,
 * message queues, or APIs through a consistent interface.
 */

/**
 * External system adapter interface
 */
export interface ExternalSystemAdapter {
  /**
   * Connect to the external system
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the external system
   */
  disconnect(): Promise<void>;
  
  /**
   * Execute an operation on the external system
   */
  execute<T = any>(operation: string, params: Record<string, any>): Promise<T>;
  
  /**
   * Subscribe to events from the external system
   */
  subscribe(event: string, handler: (data: any) => void): Promise<void>;
  
  /**
   * Get the status of the connection
   */
  getStatus(): Promise<{ connected: boolean; details: Record<string, any> }>;
}

/**
 * External system adapter configuration
 */
export interface ExternalSystemAdapterConfig {
  /**
   * Type of external system adapter
   */
  type: string;

  /**
   * Configuration options specific to the adapter type
   */
  options: Record<string, any>;
}

/**
 * Configuration options for the memory external system adapter
 */
export interface MemoryExternalSystemAdapterOptions {
  /**
   * Name of the in-memory system
   */
  name: string;

  /**
   * Initial data to populate the system with
   */
  initialData?: Record<string, any[]>;
}

/**
 * In-memory implementation of the ExternalSystemAdapter interface for testing
 */
export class MemoryExternalSystemAdapter implements ExternalSystemAdapter {
  private connected: boolean = false;
  private data: Record<string, any[]>;
  private eventHandlers: Record<string, Array<(data: any) => void>> = {};
  
  /**
   * Constructor
   * @param options Configuration options
   */
  constructor(private options: MemoryExternalSystemAdapterOptions) {
    this.data = options.initialData ? JSON.parse(JSON.stringify(options.initialData)) : {};
  }

  /**
   * Connect to the external system
   */
  async connect(): Promise<void> {
    this.connected = true;
  }

  /**
   * Disconnect from the external system
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Execute an operation on the external system
   */
  async execute<T = any>(operation: string, params: Record<string, any>): Promise<T> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    switch (operation) {
      case 'query':
        return this.executeQuery(params) as unknown as T;
      case 'insert':
        return this.executeInsert(params) as unknown as T;
      case 'update':
        return this.executeUpdate(params) as unknown as T;
      case 'delete':
        return this.executeDelete(params) as unknown as T;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Subscribe to events from the external system
   */
  async subscribe(event: string, handler: (data: any) => void): Promise<void> {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Get the status of the connection
   */
  async getStatus(): Promise<{ connected: boolean; details: Record<string, any> }> {
    return {
      connected: this.connected,
      details: {
        name: this.options.name,
        collections: Object.keys(this.data),
        recordCount: Object.values(this.data).reduce((sum, arr) => sum + arr.length, 0)
      }
    };
  }

  /**
   * Execute a query operation
   */
  private executeQuery(params: Record<string, any>): any[] {
    const { collection, filter = {} } = params;
    
    if (!this.data[collection]) {
      return [];
    }
    
    return this.data[collection].filter(item => {
      return Object.entries(filter).every(([key, value]) => item[key] === value);
    });
  }

  /**
   * Execute an insert operation
   */
  private executeInsert(params: Record<string, any>): any {
    const { collection, data } = params;
    
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    
    this.data[collection].push(data);
    
    // Emit event
    this.emitEvent('dataChanged', {
      type: 'dataChanged',
      collection,
      operation: 'insert',
      data
    });
    
    return { success: true, insertedId: data.id };
  }

  /**
   * Execute an update operation
   */
  private executeUpdate(params: Record<string, any>): any {
    const { collection, filter, data } = params;
    
    if (!this.data[collection]) {
      return { success: false, matchedCount: 0, modifiedCount: 0 };
    }
    
    let matchedCount = 0;
    let modifiedCount = 0;
    
    this.data[collection] = this.data[collection].map(item => {
      const matches = Object.entries(filter).every(([key, value]) => item[key] === value);
      
      if (matches) {
        matchedCount++;
        modifiedCount++;
        
        // Emit event
        this.emitEvent('dataChanged', {
          type: 'dataChanged',
          collection,
          operation: 'update',
          data: { ...item, ...data }
        });
        
        return { ...item, ...data };
      }
      
      return item;
    });
    
    return { success: true, matchedCount, modifiedCount };
  }

  /**
   * Execute a delete operation
   */
  private executeDelete(params: Record<string, any>): any {
    const { collection, filter } = params;
    
    if (!this.data[collection]) {
      return { success: false, deletedCount: 0 };
    }
    
    const originalLength = this.data[collection].length;
    
    this.data[collection] = this.data[collection].filter(item => {
      const matches = Object.entries(filter).every(([key, value]) => item[key] === value);
      
      if (matches) {
        // Emit event
        this.emitEvent('dataChanged', {
          type: 'dataChanged',
          collection,
          operation: 'delete',
          data: item
        });
      }
      
      return !matches;
    });
    
    const deletedCount = originalLength - this.data[collection].length;
    
    return { success: true, deletedCount };
  }

  /**
   * Emit an event to all registered handlers
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventHandlers[event]) {
      for (const handler of this.eventHandlers[event]) {
        handler(data);
      }
    }
  }
}

/**
 * Factory for creating external system adapters
 */
export class ExternalSystemAdapterFactory {
  private adapterTypes: Record<string, new (options: any) => ExternalSystemAdapter> = {};

  /**
   * Register a new adapter type
   * @param type The adapter type name
   * @param adapterClass The adapter class constructor
   */
  registerAdapterType(type: string, adapterClass: new (options: any) => ExternalSystemAdapter): void {
    this.adapterTypes[type] = adapterClass;
  }

  /**
   * Create an external system adapter
   * @param config The adapter configuration
   * @returns An external system adapter instance
   */
  createAdapter(config: ExternalSystemAdapterConfig): ExternalSystemAdapter {
    const AdapterClass = this.adapterTypes[config.type];
    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${config.type}`);
    }
    return new AdapterClass(config.options);
  }

  /**
   * Get available adapter types
   * @returns Array of registered adapter type names
   */
  getAvailableAdapterTypes(): string[] {
    return Object.keys(this.adapterTypes);
  }
}

/**
 * Singleton instance of the external system adapter factory
 */
export const externalSystemAdapterFactory = new ExternalSystemAdapterFactory();

// Register the memory adapter by default
externalSystemAdapterFactory.registerAdapterType('memory', MemoryExternalSystemAdapter); 