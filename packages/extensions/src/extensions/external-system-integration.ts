/**
 * @file External system integration extension
 * @module @architectlm/extensions
 */

import { ExternalSystemAdapter, ExternalSystemAdapterConfig } from '../external-system-adapter.js';

/**
 * Interface for external system integration options
 */
export interface ExternalSystemIntegrationOptions {
  /**
   * Map of system names to adapter configurations
   */
  systems: Record<string, ExternalSystemAdapterConfig>;
  
  /**
   * Whether to automatically connect to all systems on initialization
   */
  autoConnect?: boolean;
  
  /**
   * Whether to automatically disconnect from all systems on shutdown
   */
  autoDisconnect?: boolean;
  
  /**
   * Timeout for connection attempts in milliseconds
   */
  connectionTimeout?: number;
  
  /**
   * Whether to retry failed connections
   */
  retryConnection?: boolean;
  
  /**
   * Maximum number of connection retry attempts
   */
  maxRetryAttempts?: number;
  
  /**
   * Delay between retry attempts in milliseconds
   */
  retryDelay?: number;
}

/**
 * Extension point for external system operations
 */
export interface ExternalSystemOperationContext<T = any> {
  /**
   * Name of the external system
   */
  systemName: string;
  
  /**
   * Operation to execute
   */
  operation: string;
  
  /**
   * Parameters for the operation
   */
  params: Record<string, any>;
  
  /**
   * Result of the operation (set by the extension)
   */
  result?: T;
  
  /**
   * Error that occurred during the operation (set by the extension)
   */
  error?: Error;
}

/**
 * Extension for integrating with external systems
 */
export class ExternalSystemIntegrationExtension {
  /**
   * Extension name
   */
  name = 'external-system-integration';
  
  /**
   * Extension description
   */
  description = 'Integrates with external systems through a consistent interface';
  
  /**
   * Map of system names to adapter instances
   */
  private systems: Map<string, ExternalSystemAdapter> = new Map();
  
  /**
   * Map of system names to connection status
   */
  private connectionStatus: Map<string, boolean> = new Map();
  
  /**
   * Constructor
   * @param adapterFactory Factory for creating external system adapters
   * @param options Configuration options
   */
  constructor(
    private adapterFactory: {
      createAdapter(config: ExternalSystemAdapterConfig): ExternalSystemAdapter;
    },
    private options: ExternalSystemIntegrationOptions
  ) {
    // Set default options
    this.options.autoConnect = this.options.autoConnect ?? true;
    this.options.autoDisconnect = this.options.autoDisconnect ?? true;
    this.options.connectionTimeout = this.options.connectionTimeout ?? 30000;
    this.options.retryConnection = this.options.retryConnection ?? true;
    this.options.maxRetryAttempts = this.options.maxRetryAttempts ?? 3;
    this.options.retryDelay = this.options.retryDelay ?? 1000;
    
    // Initialize systems
    this.initializeSystems();
    
    // Auto-connect if enabled
    if (this.options.autoConnect) {
      this.connectAll();
    }
  }
  
  /**
   * Initialize all configured systems
   */
  private initializeSystems(): void {
    for (const [name, config] of Object.entries(this.options.systems)) {
      try {
        const adapter = this.adapterFactory.createAdapter(config);
        this.systems.set(name, adapter);
        this.connectionStatus.set(name, false);
      } catch (error) {
        console.error(`Failed to initialize external system '${name}':`, error);
      }
    }
  }
  
  /**
   * Connect to all systems
   */
  async connectAll(): Promise<void> {
    const connectionPromises: Promise<void>[] = [];
    
    for (const [name, adapter] of this.systems.entries()) {
      connectionPromises.push(this.connectSystem(name, adapter));
    }
    
    await Promise.all(connectionPromises);
  }
  
  /**
   * Connect to a specific system
   * @param name System name
   * @param adapter System adapter
   */
  private async connectSystem(name: string, adapter: ExternalSystemAdapter): Promise<void> {
    let attempts = 0;
    
    while (attempts <= this.options.maxRetryAttempts!) {
      try {
        await Promise.race([
          adapter.connect(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Connection to '${name}' timed out after ${this.options.connectionTimeout}ms`));
            }, this.options.connectionTimeout);
          })
        ]);
        
        this.connectionStatus.set(name, true);
        console.log(`Connected to external system '${name}'`);
        return;
      } catch (error) {
        attempts++;
        
        if (!this.options.retryConnection || attempts > this.options.maxRetryAttempts!) {
          console.error(`Failed to connect to external system '${name}':`, error);
          return;
        }
        
        console.warn(`Connection to '${name}' failed, retrying (${attempts}/${this.options.maxRetryAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
      }
    }
  }
  
  /**
   * Disconnect from all systems
   */
  async disconnectAll(): Promise<void> {
    const disconnectionPromises: Promise<void>[] = [];
    
    for (const [name, adapter] of this.systems.entries()) {
      if (this.connectionStatus.get(name)) {
        disconnectionPromises.push(
          adapter.disconnect().then(() => {
            this.connectionStatus.set(name, false);
            console.log(`Disconnected from external system '${name}'`);
          }).catch(error => {
            console.error(`Failed to disconnect from external system '${name}':`, error);
          })
        );
      }
    }
    
    await Promise.all(disconnectionPromises);
  }
  
  /**
   * Execute an operation on an external system
   * @param context Operation context
   */
  async executeOperation<T = any>(context: ExternalSystemOperationContext<T>): Promise<ExternalSystemOperationContext<T>> {
    const { systemName, operation, params } = context;
    
    const adapter = this.systems.get(systemName);
    if (!adapter) {
      context.error = new Error(`External system '${systemName}' not found`);
      return context;
    }
    
    if (!this.connectionStatus.get(systemName)) {
      context.error = new Error(`Not connected to external system '${systemName}'`);
      return context;
    }
    
    try {
      context.result = await adapter.execute(operation, params);
      return context;
    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      return context;
    }
  }
  
  /**
   * Subscribe to events from an external system
   * @param systemName Name of the system
   * @param event Event name
   * @param handler Event handler
   */
  async subscribeToEvent(systemName: string, event: string, handler: (data: any) => void): Promise<void> {
    const adapter = this.systems.get(systemName);
    if (!adapter) {
      throw new Error(`External system '${systemName}' not found`);
    }
    
    if (!this.connectionStatus.get(systemName)) {
      throw new Error(`Not connected to external system '${systemName}'`);
    }
    
    await adapter.subscribe(event, handler);
  }
  
  /**
   * Get the status of all systems
   */
  async getSystemStatuses(): Promise<Record<string, { connected: boolean; details: Record<string, any> }>> {
    const statuses: Record<string, { connected: boolean; details: Record<string, any> }> = {};
    
    for (const [name, adapter] of this.systems.entries()) {
      try {
        statuses[name] = await adapter.getStatus();
      } catch (error) {
        statuses[name] = {
          connected: false,
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
    
    return statuses;
  }
  
  /**
   * Cleanup resources when the extension is destroyed
   */
  async destroy(): Promise<void> {
    if (this.options.autoDisconnect) {
      await this.disconnectAll();
    }
  }
  
  /**
   * Extension hooks
   */
  hooks = {
    /**
     * Hook for executing operations on external systems
     */
    'external-system:execute': async (context: ExternalSystemOperationContext) => {
      return this.executeOperation(context);
    },
    
    /**
     * Hook for getting the status of all systems
     */
    'external-system:status': async () => {
      return this.getSystemStatuses();
    },
    
    /**
     * Hook for connecting to all systems
     */
    'external-system:connect-all': async () => {
      await this.connectAll();
      return { success: true };
    },
    
    /**
     * Hook for disconnecting from all systems
     */
    'external-system:disconnect-all': async () => {
      await this.disconnectAll();
      return { success: true };
    }
  };
}

/**
 * Create an external system integration extension
 * @param adapterFactory Factory for creating external system adapters
 * @param options Configuration options
 */
export function createExternalSystemIntegration(
  adapterFactory: {
    createAdapter(config: ExternalSystemAdapterConfig): ExternalSystemAdapter;
  },
  options: ExternalSystemIntegrationOptions
): ExternalSystemIntegrationExtension {
  return new ExternalSystemIntegrationExtension(adapterFactory, options);
} 