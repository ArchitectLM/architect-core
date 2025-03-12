/**
 * Tests for HTTP API
 * 
 * These tests verify that the HTTP API can:
 * 1. Start and stop the server
 * 2. Load a system
 * 3. Execute tasks
 * 4. Send events
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RuntimeHttpApi } from '../../src/runtime/http-api';
import type { ReactiveSystem, Trigger } from '../../src/schema/types';
import http from 'http';

// Sample triggers
const sampleTriggers: Trigger[] = [
  {
    type: "user_event",
    name: "todo-created",
    description: "Triggered when a new todo is created"
  },
  {
    type: "user_event",
    name: "todo-completed",
    description: "Triggered when a todo is marked as completed"
  }
];

// Sample system definition
const sampleSystem: ReactiveSystem = {
  id: 'todo-system',
  name: 'Todo System',
  version: '1.0.0',
  description: 'A simple todo management system',
  boundedContexts: {
    'todos': {
      id: 'todos',
      name: 'Todo Management',
      description: 'Manages todo items and lists',
      processes: ['manage-todos']
    }
  },
  processes: {
    'manage-todos': {
      id: 'manage-todos',
      name: 'Manage Todos',
      type: 'stateful',
      contextId: 'todos',
      triggers: sampleTriggers,
      tasks: ['validate-todo', 'save-todo', 'update-todo', 'delete-todo'],
      states: ['active', 'completed', 'archived'],
      transitions: [
        { from: 'active', to: 'completed', on: 'complete' },
        { from: 'completed', to: 'active', on: 'reactivate' },
        { from: 'active', to: 'archived', on: 'archive' },
        { from: 'completed', to: 'archived', on: 'archive' },
        { from: 'archived', to: 'active', on: 'restore' }
      ]
    }
  },
  tasks: {
    'validate-todo': {
      id: 'validate-todo',
      type: 'operation',
      label: 'Validate Todo',
      description: 'Validates todo data',
      input: ['title', 'description', 'dueDate'],
      output: ['isValid', 'errors']
    },
    'save-todo': {
      id: 'save-todo',
      type: 'operation',
      label: 'Save Todo',
      description: 'Saves todo to database',
      input: ['todo'],
      output: ['id', 'success']
    },
    'update-todo': {
      id: 'update-todo',
      type: 'operation',
      label: 'Update Todo',
      description: 'Updates todo in database',
      input: ['todoId', 'updates'],
      output: ['success']
    },
    'delete-todo': {
      id: 'delete-todo',
      type: 'operation',
      label: 'Delete Todo',
      description: 'Deletes todo from database',
      input: ['todoId'],
      output: ['success']
    }
  }
};

/**
 * Helper function to make HTTP requests
 * @param options Request options
 * @param data Request data
 * @returns Response data
 */
function makeRequest(options: http.RequestOptions, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

describe('RuntimeHttpApi', () => {
  const port = 3001;
  const baseUrl = `http://localhost:${port}`;
  let server: RuntimeHttpApi;

  beforeAll(async () => {
    // Create and start server
    server = new RuntimeHttpApi(port);
    await server.start();
  });

  afterAll(async () => {
    // Stop server
    await server.stop();
  });

  it('should return status with no system loaded', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/status',
      method: 'GET'
    });

    expect(response.statusCode).toBe(200);
    expect(response.data).toEqual({
      initialized: false
    });
  });

  it('should load a system', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/system',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, sampleSystem);

    expect(response.statusCode).toBe(200);
    expect(response.data).toEqual({
      success: true,
      systemId: 'todo-system',
      version: '1.0.0'
    });
  });

  it('should return status with system loaded', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/status',
      method: 'GET'
    });

    expect(response.statusCode).toBe(200);
    expect(response.data).toEqual({
      initialized: true,
      systemId: 'todo-system',
      version: '1.0.0'
    });
  });

  it('should execute a task with valid input', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/task',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      taskId: 'validate-todo',
      input: { title: 'Test Todo' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.result).toEqual({
      isValid: true,
      errors: []
    });
  });

  it('should execute a task with invalid input', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/task',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      taskId: 'validate-todo',
      input: { title: '' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.result).toEqual({
      isValid: false,
      errors: ['Title is required']
    });
  });

  it('should return an error for non-existent task', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/task',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      taskId: 'non-existent-task',
      input: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.data.error).toBe('Task non-existent-task not found');
  });

  it('should send an event', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      eventType: 'complete',
      payload: { processId: 'manage-todos' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.data.success).toBe(true);
  });
}); 