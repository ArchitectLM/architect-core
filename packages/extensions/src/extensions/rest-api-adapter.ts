/**
 * REST API Adapter for External System Integration
 * 
 * This module provides an implementation of the ExternalSystemAdapter interface
 * for interacting with REST APIs. It supports common HTTP methods (GET, POST, PUT, DELETE)
 * and handles authentication, request formatting, and response parsing.
 */

import { ExternalSystemAdapter, ExternalSystemAdapterFactory } from '../external-system-adapter.js';

/**
 * Configuration options for the REST API adapter
 */
export interface RestApiAdapterOptions {
  /**
   * Base URL for the REST API (e.g., "https://api.example.com/v1")
   */
  baseUrl: string;
  
  /**
   * Default headers to include with every request
   */
  defaultHeaders?: Record<string, string>;
  
  /**
   * Authentication configuration
   */
  auth?: {
    /**
     * Authentication type
     */
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    
    /**
     * Username for basic authentication
     */
    username?: string;
    
    /**
     * Password for basic authentication
     */
    password?: string;
    
    /**
     * Token for bearer authentication
     */
    token?: string;
    
    /**
     * API key name and value for api-key authentication
     */
    apiKey?: {
      name: string;
      value: string;
      in: 'header' | 'query';
    };
  };
  
  /**
   * Timeout in milliseconds for requests
   * @default 30000 (30 seconds)
   */
  timeout?: number;
  
  /**
   * Whether to automatically retry failed requests
   * @default false
   */
  retry?: boolean;
  
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Resource mappings for the API
   * Maps logical resource names to API endpoints
   */
  resources?: Record<string, {
    /**
     * Endpoint path relative to the base URL
     */
    path: string;
    
    /**
     * Custom operations for this resource
     */
    operations?: Record<string, {
      /**
       * HTTP method to use
       */
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      
      /**
       * Path template for the operation
       * Can include parameters like ":id" that will be replaced with values from params
       */
      path?: string;
      
      /**
       * Whether to include the request body
       */
      body?: boolean;
      
      /**
       * Custom headers for this operation
       */
      headers?: Record<string, string>;
    }>;
  }>;
}

/**
 * REST API Adapter implementation
 * 
 * Provides a way to interact with REST APIs using the ExternalSystemAdapter interface
 */
export class RestApiAdapter implements ExternalSystemAdapter {
  private options: RestApiAdapterOptions;
  private connected: boolean = false;
  private eventHandlers: Record<string, Array<(event: any) => void>> = {};
  private abortController: AbortController | null = null;
  
  /**
   * Creates a new REST API adapter
   * 
   * @param options Configuration options for the adapter
   */
  constructor(options: RestApiAdapterOptions) {
    this.options = {
      ...options,
      timeout: options.timeout ?? 30000,
      retry: options.retry ?? false,
      maxRetries: options.maxRetries ?? 3,
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.defaultHeaders || {})
      }
    };
  }
  
  /**
   * Connects to the REST API
   * 
   * For REST APIs, this performs a health check to verify the API is accessible
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    
    this.abortController = new AbortController();
    
    try {
      // Perform a simple health check to verify the API is accessible
      const response = await fetch(this.options.baseUrl, {
        method: 'HEAD',
        headers: this.getHeaders(),
        signal: this.abortController.signal
      });
      
      if (!response.ok && response.status !== 404) {
        // 404 is acceptable as the base URL might not have a handler
        throw new Error(`Failed to connect to REST API: ${response.status} ${response.statusText}`);
      }
      
      this.connected = true;
      console.log(`Connected to REST API at ${this.options.baseUrl}`);
    } catch (error) {
      this.abortController = null;
      throw new Error(`Failed to connect to REST API: ${(error as Error).message}`);
    }
  }
  
  /**
   * Disconnects from the REST API
   * 
   * For REST APIs, this cancels any pending requests
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.connected = false;
    console.log(`Disconnected from REST API at ${this.options.baseUrl}`);
  }
  
  /**
   * Executes an operation on the REST API
   * 
   * @param operation The operation to execute (query, insert, update, delete, or custom)
   * @param params Parameters for the operation
   * @returns The result of the operation
   */
  async execute<T = any>(operation: string, params: Record<string, any>): Promise<T> {
    if (!this.connected) {
      throw new Error('Not connected to REST API');
    }
    
    // Create a new abort controller for this request
    const abortController = new AbortController();
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.options.timeout);
    
    try {
      switch (operation) {
        case 'query':
          return await this.executeQuery(params, abortController.signal) as T;
        case 'insert':
          return await this.executeInsert(params, abortController.signal) as T;
        case 'update':
          return await this.executeUpdate(params, abortController.signal) as T;
        case 'delete':
          return await this.executeDelete(params, abortController.signal) as T;
        default:
          return await this.executeCustomOperation(operation, params, abortController.signal) as T;
      }
    } catch (error) {
      // Emit error event
      this.emitEvent('error', {
        operation,
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Subscribes to events from the REST API
   * 
   * @param eventType The type of event to subscribe to
   * @param handler The handler function to call when the event occurs
   */
  async subscribe(eventType: string, handler: (event: any) => void): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to REST API');
    }
    
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    
    this.eventHandlers[eventType].push(handler);
  }
  
  /**
   * Gets the status of the REST API connection
   * 
   * @returns The connection status and details
   */
  async getStatus(): Promise<{ connected: boolean; details: Record<string, any> }> {
    return {
      connected: this.connected,
      details: {
        baseUrl: this.options.baseUrl,
        timeout: this.options.timeout,
        retry: this.options.retry
      }
    };
  }
  
  /**
   * Executes a query operation on the REST API
   * 
   * @param params Parameters for the query
   * @param signal AbortSignal for cancellation
   * @returns The query results
   */
  private async executeQuery(params: Record<string, any>, signal: AbortSignal): Promise<any> {
    const { collection, id, filter } = params;
    
    if (!collection) {
      throw new Error('Collection name is required for query operations');
    }
    
    const resource = this.getResourceConfig(collection);
    let url = `${this.options.baseUrl}/${resource.path}`;
    
    // Handle ID-based queries
    if (id) {
      url = `${url}/${id}`;
    }
    
    // Handle filter-based queries
    const queryParams = new URLSearchParams();
    if (filter && typeof filter === 'object') {
      Object.entries(filter).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
    }
    
    // Add query parameters to URL if present
    const queryString = queryParams.toString();
    if (queryString) {
      url = `${url}?${queryString}`;
    }
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.getHeaders(),
      signal
    });
    
    const data = await response.json();
    
    // Emit data changed event
    this.emitEvent('dataChanged', {
      type: 'dataChanged',
      collection,
      operation: 'query',
      data
    });
    
    return data;
  }
  
  /**
   * Executes an insert operation on the REST API
   * 
   * @param params Parameters for the insert
   * @param signal AbortSignal for cancellation
   * @returns The insert result
   */
  private async executeInsert(params: Record<string, any>, signal: AbortSignal): Promise<any> {
    const { collection, data } = params;
    
    if (!collection) {
      throw new Error('Collection name is required for insert operations');
    }
    
    if (!data) {
      throw new Error('Data is required for insert operations');
    }
    
    const resource = this.getResourceConfig(collection);
    const url = `${this.options.baseUrl}/${resource.path}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      signal
    });
    
    const result = await response.json();
    
    // Emit data changed event
    this.emitEvent('dataChanged', {
      type: 'dataChanged',
      collection,
      operation: 'insert',
      data
    });
    
    return {
      success: true,
      id: result.id || result._id,
      result
    };
  }
  
  /**
   * Executes an update operation on the REST API
   * 
   * @param params Parameters for the update
   * @param signal AbortSignal for cancellation
   * @returns The update result
   */
  private async executeUpdate(params: Record<string, any>, signal: AbortSignal): Promise<any> {
    const { collection, id, data } = params;
    
    if (!collection) {
      throw new Error('Collection name is required for update operations');
    }
    
    if (!id) {
      throw new Error('ID is required for update operations');
    }
    
    if (!data) {
      throw new Error('Data is required for update operations');
    }
    
    const resource = this.getResourceConfig(collection);
    const url = `${this.options.baseUrl}/${resource.path}/${id}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      signal
    });
    
    const result = await response.json();
    
    // Emit data changed event
    this.emitEvent('dataChanged', {
      type: 'dataChanged',
      collection,
      operation: 'update',
      id,
      data
    });
    
    return {
      success: true,
      result
    };
  }
  
  /**
   * Executes a delete operation on the REST API
   * 
   * @param params Parameters for the delete
   * @param signal AbortSignal for cancellation
   * @returns The delete result
   */
  private async executeDelete(params: Record<string, any>, signal: AbortSignal): Promise<any> {
    const { collection, id } = params;
    
    if (!collection) {
      throw new Error('Collection name is required for delete operations');
    }
    
    if (!id) {
      throw new Error('ID is required for delete operations');
    }
    
    const resource = this.getResourceConfig(collection);
    const url = `${this.options.baseUrl}/${resource.path}/${id}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      signal
    });
    
    // Some APIs return no content for DELETE
    let result;
    try {
      result = await response.json();
    } catch {
      result = { success: response.ok };
    }
    
    // Emit data changed event
    this.emitEvent('dataChanged', {
      type: 'dataChanged',
      collection,
      operation: 'delete',
      id
    });
    
    return {
      success: true,
      result
    };
  }
  
  /**
   * Executes a custom operation on the REST API
   * 
   * @param operation The custom operation name
   * @param params Parameters for the operation
   * @param signal AbortSignal for cancellation
   * @returns The operation result
   */
  private async executeCustomOperation(
    operation: string,
    params: Record<string, any>,
    signal: AbortSignal
  ): Promise<any> {
    const { collection } = params;
    
    if (!collection) {
      throw new Error('Collection name is required for custom operations');
    }
    
    const resource = this.getResourceConfig(collection);
    
    // Check if the operation is defined for this resource
    if (!resource.operations || !resource.operations[operation]) {
      throw new Error(`Unknown operation: ${operation} for collection ${collection}`);
    }
    
    const operationConfig = resource.operations[operation];
    let path = operationConfig.path || resource.path;
    
    // Replace path parameters
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, encodeURIComponent(String(value)));
    });
    
    const url = `${this.options.baseUrl}/${path}`;
    
    const requestOptions: RequestInit = {
      method: operationConfig.method,
      headers: {
        ...this.getHeaders(),
        ...(operationConfig.headers || {})
      },
      signal
    };
    
    // Add body if needed
    if (operationConfig.body && params.data) {
      requestOptions.body = JSON.stringify(params.data);
    }
    
    const response = await this.fetchWithRetry(url, requestOptions);
    
    // Try to parse JSON response
    let result;
    try {
      result = await response.json();
    } catch {
      // Handle non-JSON responses
      result = { success: response.ok };
    }
    
    // Emit data changed event
    this.emitEvent('dataChanged', {
      type: 'dataChanged',
      collection,
      operation,
      params
    });
    
    return result;
  }
  
  /**
   * Gets the headers for a request, including authentication
   * 
   * @returns The headers for the request
   */
  private getHeaders(): Record<string, string> {
    const headers = { ...this.options.defaultHeaders };
    
    // Add authentication headers
    if (this.options.auth) {
      switch (this.options.auth.type) {
        case 'basic':
          if (this.options.auth.username && this.options.auth.password) {
            const credentials = btoa(`${this.options.auth.username}:${this.options.auth.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'bearer':
          if (this.options.auth.token) {
            headers['Authorization'] = `Bearer ${this.options.auth.token}`;
          }
          break;
        case 'api-key':
          if (this.options.auth.apiKey && this.options.auth.apiKey.in === 'header') {
            headers[this.options.auth.apiKey.name] = this.options.auth.apiKey.value;
          }
          break;
      }
    }
    
    return headers;
  }
  
  /**
   * Gets the resource configuration for a collection
   * 
   * @param collection The collection name
   * @returns The resource configuration
   */
  private getResourceConfig(collection: string): { path: string; operations?: Record<string, any> } {
    if (!this.options.resources || !this.options.resources[collection]) {
      // Default to using the collection name as the path
      return { path: collection };
    }
    
    return this.options.resources[collection];
  }
  
  /**
   * Performs a fetch request with retry logic
   * 
   * @param url The URL to fetch
   * @param options The fetch options
   * @returns The fetch response
   */
  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let attempts = 0;
    let lastError: Error | null = null;
    
    while (attempts < (this.options.retry ? this.options.maxRetries! : 1)) {
      attempts++;
      
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if the request was aborted
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        
        // Don't retry if we've reached the maximum attempts
        if (attempts >= (this.options.retry ? this.options.maxRetries! : 1)) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
    throw lastError || new Error('Failed to fetch after multiple attempts');
  }
  
  /**
   * Emits an event to all registered handlers
   * 
   * @param eventType The type of event to emit
   * @param event The event data
   */
  private emitEvent(eventType: string, event: any): void {
    if (this.eventHandlers[eventType]) {
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }
  }
}

/**
 * Register the REST API adapter with the factory
 * 
 * @param factory The external system adapter factory
 */
export function registerRestApiAdapter(factory: ExternalSystemAdapterFactory): void {
  factory.registerAdapterType('rest-api', RestApiAdapter);
} 