/**
 * HTTP API for Runtime
 * 
 * This module provides a simple HTTP API for interacting with the runtime.
 * It allows:
 * - Loading a system
 * - Registering task implementations
 * - Executing tasks
 * - Sending events
 */

import http from 'http';
import { URL } from 'url';
import { ReactiveSystemRuntime } from './runtime-core';
import type { ReactiveSystem } from '../schema/types';

// Store for registered task implementations (mocked LLM outputs)
const mockTaskImplementations: Record<string, (input: any) => Promise<any>> = {
  'validate-todo': async (input: any) => {
    const isValid = Boolean(input.title && input.title.length > 0);
    return { isValid, errors: isValid ? [] : ['Title is required'] };
  },
  'save-todo': async (input: any) => {
    return { id: `todo-${Date.now()}`, success: true };
  },
  'update-todo': async (input: any) => {
    return { success: true };
  },
  'delete-todo': async (input: any) => {
    return { success: true };
  }
};

/**
 * HTTP API Server
 */
export class RuntimeHttpApi {
  private server: http.Server;
  private runtime: ReactiveSystemRuntime | null = null;
  private port: number;

  /**
   * Creates a new RuntimeHttpApi
   * @param port Port to listen on
   */
  constructor(port: number = 3000) {
    this.port = port;
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  /**
   * Starts the HTTP server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`Runtime HTTP API listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stops the HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handles HTTP requests
   * @param req HTTP request
   * @param res HTTP response
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // Parse URL
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const path = url.pathname;
      const method = req.method || 'GET';

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight requests
      if (method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      // Parse request body for POST requests
      let body = '';
      if (method === 'POST') {
        body = await this.readRequestBody(req);
      }

      // Route request
      if (path === '/system' && method === 'POST') {
        // Load system
        await this.handleLoadSystem(body, res);
      } else if (path === '/task' && method === 'POST') {
        // Execute task
        await this.handleExecuteTask(body, res);
      } else if (path === '/event' && method === 'POST') {
        // Send event
        await this.handleSendEvent(body, res);
      } else if (path === '/status' && method === 'GET') {
        // Get runtime status
        this.handleGetStatus(res);
      } else {
        // Not found
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error: any) {
      // Handle errors
      console.error('Error handling request:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Reads the request body
   * @param req HTTP request
   * @returns Request body as string
   */
  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Handles loading a system
   * @param body Request body
   * @param res HTTP response
   */
  private async handleLoadSystem(body: string, res: http.ServerResponse): Promise<void> {
    try {
      // Parse system definition
      const system = JSON.parse(body) as ReactiveSystem;

      // Create runtime
      this.runtime = new ReactiveSystemRuntime(system);

      // Register mock task implementations
      Object.entries(mockTaskImplementations).forEach(([taskId, implementation]) => {
        if (this.runtime?.hasTask(taskId)) {
          this.runtime.registerTaskImplementation(taskId, implementation);
        }
      });

      // Send response
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        systemId: system.id,
        version: system.version
      }));
    } catch (error: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Handles executing a task
   * @param body Request body
   * @param res HTTP response
   */
  private async handleExecuteTask(body: string, res: http.ServerResponse): Promise<void> {
    try {
      // Check if runtime is initialized
      if (!this.runtime) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'No system loaded' }));
        return;
      }

      // Parse request
      const request = JSON.parse(body) as { taskId: string; input: any };

      // Execute task
      const result = await this.runtime.executeTask(request.taskId, request.input);

      // Send response
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        result
      }));
    } catch (error: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Handles sending an event
   * @param body Request body
   * @param res HTTP response
   */
  private async handleSendEvent(body: string, res: http.ServerResponse): Promise<void> {
    try {
      // Check if runtime is initialized
      if (!this.runtime) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'No system loaded' }));
        return;
      }

      // Parse request
      const request = JSON.parse(body) as { eventType: string; payload: any };

      // Send event
      this.runtime.sendEvent(request.eventType, request.payload);

      // Send response
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true
      }));
    } catch (error: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Handles getting runtime status
   * @param res HTTP response
   */
  private handleGetStatus(res: http.ServerResponse): void {
    // Check if runtime is initialized
    if (!this.runtime) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        initialized: false
      }));
      return;
    }

    // Send response
    res.statusCode = 200;
    res.end(JSON.stringify({
      initialized: true,
      systemId: this.runtime.getSystemId(),
      version: this.runtime.getSystemVersion()
    }));
  }
} 