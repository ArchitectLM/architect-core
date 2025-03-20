import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the query extension module
vi.mock('../../src/extensions/query.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/query.extension.js');
  return {
    ...actual,
    setupQueryExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupQueryExtension, 
  QueryExtensionOptions
} from '../../src/extensions/query.extension.js';

describe('Query Extension', () => {
  let dsl: DSL;
  let queryOptions: QueryExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    queryOptions = {
      defaultCacheTtl: 5000,
      enableCaching: true,
      maxCacheItems: 100,
      autoValidateInput: true,
      autoValidateOutput: true
    };
    
    // Setup extension
    setupQueryExtension(dsl, queryOptions);

    // Create schemas for testing
    dsl.component('UserSchema', {
      type: ComponentType.SCHEMA,
      description: 'User schema for tests',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      },
      required: ['id', 'name', 'email']
    });
    
    dsl.component('UserListSchema', {
      type: ComponentType.SCHEMA,
      description: 'User list schema for tests',
      version: '1.0.0',
      properties: {
        users: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserSchema' }
        },
        total: { type: 'number' }
      },
      required: ['users', 'total']
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Execution', () => {
    it('should add execute method to query components', async () => {
      // Define a query component
      const getUsersQuery = dsl.component('GetUsers', {
        type: ComponentType.QUERY,
        description: 'Get users query',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Create a mock implementation
      const getUsersMock = vi.fn().mockResolvedValue({
        users: [
          { id: 'user1', name: 'John Doe', email: 'john@example.com' },
          { id: 'user2', name: 'Jane Doe', email: 'jane@example.com' }
        ],
        total: 2
      });
      
      // Implement the query
      dsl.implement('GetUsers', getUsersMock);
      
      // The extension should add an execute method to the query
      expect(typeof (getUsersQuery as any).execute).toBe('function');
      
      // Execute the query
      const input = { id: 'user1' };
      const result = await (getUsersQuery as any).execute(input);
      
      // Verify the mock was called with the right input
      expect(getUsersMock).toHaveBeenCalledWith(input, expect.any(Object));
      
      // Verify the result
      expect(result).toEqual({
        users: [
          { id: 'user1', name: 'John Doe', email: 'john@example.com' },
          { id: 'user2', name: 'Jane Doe', email: 'jane@example.com' }
        ],
        total: 2
      });
    });
  });

  describe('Query Caching', () => {
    it('should cache query results when caching is enabled', async () => {
      // Define a query component
      const expensiveQuery = dsl.component('ExpensiveQuery', {
        type: ComponentType.QUERY,
        description: 'An expensive query that should benefit from caching',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Create a mock implementation that counts calls
      const queryImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'user1', name: 'Test User', email: 'test@example.com' }],
        total: 1
      });
      
      // Implement the query
      dsl.implement('ExpensiveQuery', queryImplementation);
      
      // Execute the query with the same input multiple times
      const input = { id: 'user1' };
      
      // First execution should call the implementation
      await (expensiveQuery as any).execute(input);
      expect(queryImplementation).toHaveBeenCalledTimes(1);
      
      // Second execution with same input should use cache
      await (expensiveQuery as any).execute(input);
      expect(queryImplementation).toHaveBeenCalledTimes(1); // Still 1, used cache
      
      // Different input should call implementation again
      await (expensiveQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(2);
      
      // Disabling cache should call implementation
      const contextWithoutCache = { enableCaching: false };
      await (expensiveQuery as any).execute(input, contextWithoutCache);
      expect(queryImplementation).toHaveBeenCalledTimes(3);
    });
    
    it('should respect cache TTL settings', async () => {
      // Define a query component
      const timedQuery = dsl.component('TimedQuery', {
        type: ComponentType.QUERY,
        description: 'A query with custom cache TTL',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' },
        cacheTtl: 100 // 100ms cache TTL
      });
      
      // Mock Date.now() to control time
      const originalNow = Date.now;
      let currentTime = 1000;
      Date.now = vi.fn(() => currentTime);
      
      // Create a mock implementation
      const queryImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'user1', name: 'Test User', email: 'test@example.com' }],
        total: 1
      });
      
      // Implement the query
      dsl.implement('TimedQuery', queryImplementation);
      
      // Execute the query
      const input = { id: 'user1' };
      await (timedQuery as any).execute(input);
      expect(queryImplementation).toHaveBeenCalledTimes(1);
      
      // Execute again immediately - should use cache
      await (timedQuery as any).execute(input);
      expect(queryImplementation).toHaveBeenCalledTimes(1);
      
      // Advance time beyond TTL
      currentTime += 150; // 150ms later, beyond the 100ms TTL
      
      // Execute again - cache should be expired
      await (timedQuery as any).execute(input);
      expect(queryImplementation).toHaveBeenCalledTimes(2);
      
      // Restore original Date.now
      Date.now = originalNow;
    });
    
    it('should respect max cache items setting', async () => {
      // Set a small cache size for testing
      const smallCacheOptions: QueryExtensionOptions = {
        ...queryOptions,
        maxCacheItems: 2 // Only cache 2 items
      };
      
      // Setup extension with small cache
      setupQueryExtension(dsl, smallCacheOptions);
      
      // Define a query component
      const boundedQuery = dsl.component('BoundedQuery', {
        type: ComponentType.QUERY,
        description: 'A query with limited cache size',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Create a mock implementation
      const queryImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'dynamic', name: 'Dynamic User', email: 'dynamic@example.com' }],
        total: 1
      });
      
      // Implement the query
      dsl.implement('BoundedQuery', queryImplementation);
      
      // Execute with different inputs to fill cache
      await (boundedQuery as any).execute({ id: 'user1' });
      await (boundedQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(2);
      
      // Execute with previously cached input - should still be in cache
      await (boundedQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(2);
      
      // Add a third item - should evict the first
      await (boundedQuery as any).execute({ id: 'user3' });
      expect(queryImplementation).toHaveBeenCalledTimes(3);
      
      // First item should have been evicted from cache
      await (boundedQuery as any).execute({ id: 'user1' });
      expect(queryImplementation).toHaveBeenCalledTimes(4);
      
      // Second item should still be in cache
      await (boundedQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(4);
    });
    
    it('should support cache operations like clear and invalidate', async () => {
      // Define a query component
      const cacheManagedQuery = dsl.component('CacheManagedQuery', {
        type: ComponentType.QUERY,
        description: 'A query with managed cache',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Create a mock implementation
      const queryImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'dynamic', name: 'Dynamic User', email: 'dynamic@example.com' }],
        total: 1
      });
      
      // Implement the query
      dsl.implement('CacheManagedQuery', queryImplementation);
      
      // Fill cache with different inputs
      await (cacheManagedQuery as any).execute({ id: 'user1' });
      await (cacheManagedQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(2);
      
      // Execute again - should use cache
      await (cacheManagedQuery as any).execute({ id: 'user1' });
      expect(queryImplementation).toHaveBeenCalledTimes(2);
      
      // Clear entire cache
      (cacheManagedQuery as any).clearCache();
      
      // Execute again - should call implementation
      await (cacheManagedQuery as any).execute({ id: 'user1' });
      expect(queryImplementation).toHaveBeenCalledTimes(3);
      
      // Fill cache again
      await (cacheManagedQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(4);
      
      // Invalidate specific key
      (cacheManagedQuery as any).invalidateCache({ id: 'user2' });
      
      // Invalidated key should call implementation
      await (cacheManagedQuery as any).execute({ id: 'user2' });
      expect(queryImplementation).toHaveBeenCalledTimes(5);
      
      // Other keys should still be in cache
      await (cacheManagedQuery as any).execute({ id: 'user1' });
      expect(queryImplementation).toHaveBeenCalledTimes(5);
    });
  });

  describe('Input Validation', () => {
    it('should validate query input against schema when enabled', async () => {
      // Define a query with a schema
      const validateInputQuery = dsl.component('ValidateInputQuery', {
        type: ComponentType.QUERY,
        description: 'A query with input validation',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Mock implementation
      const queryImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'user1', name: 'Test User', email: 'test@example.com' }],
        total: 1
      });
      
      dsl.implement('ValidateInputQuery', queryImplementation);
      
      // Valid input should pass validation
      const validInput = {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com'
      };
      
      await expect(
        (validateInputQuery as any).execute(validInput)
      ).resolves.toBeDefined();
      
      // Invalid input should fail validation
      const invalidInput = {
        id: 'user1',
        name: 'Test User',
        email: 'not-an-email' // Invalid email format
      };
      
      await expect(
        (validateInputQuery as any).execute(invalidInput)
      ).rejects.toThrow(/invalid input/i);
      
      // Should be able to disable validation
      const contextWithDisabledValidation = {
        validateInput: false
      };
      
      await expect(
        (validateInputQuery as any).execute(invalidInput, contextWithDisabledValidation)
      ).resolves.toBeDefined();
    });
  });

  describe('Output Validation', () => {
    it('should validate query output against schema when enabled', async () => {
      // Define a query with output validation
      const validateOutputQuery = dsl.component('ValidateOutputQuery', {
        type: ComponentType.QUERY,
        description: 'A query with output validation',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Mock implementation that returns valid output
      const validImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'user1', name: 'Test User', email: 'test@example.com' }],
        total: 1
      });
      
      // Mock implementation that returns invalid output
      const invalidImplementation = vi.fn().mockResolvedValue({
        users: [{ id: 'user1', name: 'Test User' }], // Missing required email
        total: 1
      });
      
      // Test with valid implementation
      dsl.implement('ValidateOutputQuery', validImplementation);
      
      await expect(
        (validateOutputQuery as any).execute({ id: 'user1' })
      ).resolves.toBeDefined();
      
      // Test with invalid implementation
      dsl.implement('ValidateOutputQuery', invalidImplementation);
      
      await expect(
        (validateOutputQuery as any).execute({ id: 'user1' })
      ).rejects.toThrow(/invalid output/i);
      
      // Should be able to disable output validation
      const contextWithDisabledValidation = {
        validateOutput: false
      };
      
      await expect(
        (validateOutputQuery as any).execute(
          { id: 'user1' },
          contextWithDisabledValidation
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Query Metrics', () => {
    it('should track query execution metrics', async () => {
      // Define a query
      const metricQuery = dsl.component('MetricQuery', {
        type: ComponentType.QUERY,
        description: 'A query with metrics',
        version: '1.0.0',
        input: { ref: 'UserSchema' },
        output: { ref: 'UserListSchema' }
      });
      
      // Mock implementation with delay
      const implementation = vi.fn().mockImplementation(async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          users: [{ id: 'user1', name: 'Test User', email: 'test@example.com' }],
          total: 1
        };
      });
      
      dsl.implement('MetricQuery', implementation);
      
      // Execute the query
      await (metricQuery as any).execute({ id: 'user1' });
      
      // Get metrics
      const metrics = (metricQuery as any).getMetrics();
      
      // Verify metrics are tracked
      expect(metrics).toBeDefined();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.cacheHitCount).toBe(0);
      expect(metrics.cacheMissCount).toBe(1);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.lastExecutionTime).toBeGreaterThan(0);
      
      // Execute again with same input - should use cache
      await (metricQuery as any).execute({ id: 'user1' });
      
      // Check updated metrics
      const updatedMetrics = (metricQuery as any).getMetrics();
      expect(updatedMetrics.executionCount).toBe(2);
      expect(updatedMetrics.cacheHitCount).toBe(1);
      expect(updatedMetrics.cacheMissCount).toBe(1);
    });
  });

  describe('System Integration', () => {
    it('should integrate queries with system definitions', () => {
      // Define some queries
      dsl.component('Query1', {
        type: ComponentType.QUERY,
        description: 'Query 1',
        version: '1.0.0',
        input: { ref: 'Input1' },
        output: { ref: 'Output1' }
      });
      
      dsl.component('Query2', {
        type: ComponentType.QUERY,
        description: 'Query 2',
        version: '1.0.0',
        input: { ref: 'Input2' },
        output: { ref: 'Output2' }
      });
      
      // Define a system that uses these queries
      const system = dsl.system('TestSystem', {
        description: 'Test system',
        version: '1.0.0',
        components: {
          queries: [
            { ref: 'Query1' },
            { ref: 'Query2' }
          ]
        }
      });
      
      // Extension should add methods to access and execute queries
      expect(typeof (system as any).getQueries).toBe('function');
      expect(typeof (system as any).executeQuery).toBe('function');
      
      // Get queries from the system
      const queries = (system as any).getQueries();
      expect(queries).toHaveLength(2);
      expect(queries[0].id).toBe('Query1');
      expect(queries[1].id).toBe('Query2');
    });
  });
}); 