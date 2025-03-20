import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ExternalSystemAdapter,
  ExternalSystemAdapterFactory,
  externalSystemAdapterFactory,
  MemoryExternalSystemAdapter
} from '../../extensions/src/external-system-adapter.js';

describe('External System Adapter', () => {
  describe('ExternalSystemAdapter Interface', () => {
    // This test ensures the interface is properly defined
    it('should define the required methods', () => {
      // This is a type check test, no assertions needed
      const methods: Array<keyof ExternalSystemAdapter> = [
        'connect',
        'disconnect',
        'execute',
        'subscribe',
        'getStatus'
      ];
      expect(methods.length).toBe(5); // Just to have an assertion
    });
  });

  describe('MemoryExternalSystemAdapter', () => {
    let adapter: MemoryExternalSystemAdapter;
    
    beforeEach(() => {
      adapter = new MemoryExternalSystemAdapter({
        name: 'test-memory-system',
        initialData: {
          users: [
            { id: '1', name: 'John Doe' },
            { id: '2', name: 'Jane Smith' }
          ]
        }
      });
    });
    
    it('should connect successfully', async () => {
      const result = await adapter.connect();
      expect(result).toBeUndefined();
      
      const status = await adapter.getStatus();
      expect(status.connected).toBe(true);
    });
    
    it('should disconnect successfully', async () => {
      await adapter.connect();
      await adapter.disconnect();
      
      const status = await adapter.getStatus();
      expect(status.connected).toBe(false);
    });
    
    it('should execute a query operation', async () => {
      await adapter.connect();
      
      const result = await adapter.execute('query', {
        collection: 'users',
        filter: { id: '1' }
      });
      
      expect(result).toEqual([{ id: '1', name: 'John Doe' }]);
    });
    
    it('should execute an insert operation', async () => {
      await adapter.connect();
      
      await adapter.execute('insert', {
        collection: 'users',
        data: { id: '3', name: 'Bob Johnson' }
      });
      
      const result = await adapter.execute('query', {
        collection: 'users',
        filter: { id: '3' }
      });
      
      expect(result).toEqual([{ id: '3', name: 'Bob Johnson' }]);
    });
    
    it('should execute an update operation', async () => {
      await adapter.connect();
      
      await adapter.execute('update', {
        collection: 'users',
        filter: { id: '1' },
        data: { name: 'John Updated' }
      });
      
      const result = await adapter.execute('query', {
        collection: 'users',
        filter: { id: '1' }
      });
      
      expect(result).toEqual([{ id: '1', name: 'John Updated' }]);
    });
    
    it('should execute a delete operation', async () => {
      await adapter.connect();
      
      await adapter.execute('delete', {
        collection: 'users',
        filter: { id: '1' }
      });
      
      const result = await adapter.execute('query', {
        collection: 'users'
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
    
    it('should throw an error for unknown operations', async () => {
      await adapter.connect();
      
      await expect(adapter.execute('unknown', {})).rejects.toThrow('Unknown operation: unknown');
    });
    
    it('should throw an error if not connected', async () => {
      await expect(adapter.execute('query', {})).rejects.toThrow('Not connected');
    });
    
    it('should subscribe to events', async () => {
      await adapter.connect();
      
      const handler = vi.fn();
      await adapter.subscribe('dataChanged', handler);
      
      // Trigger an event by modifying data
      await adapter.execute('insert', {
        collection: 'users',
        data: { id: '4', name: 'New User' }
      });
      
      expect(handler).toHaveBeenCalledWith({
        type: 'dataChanged',
        collection: 'users',
        operation: 'insert',
        data: { id: '4', name: 'New User' }
      });
    });
  });
  
  describe('ExternalSystemAdapterFactory', () => {
    let factory: ExternalSystemAdapterFactory;
    
    beforeEach(() => {
      factory = new ExternalSystemAdapterFactory();
    });
    
    it('should register and list adapter types', () => {
      factory.registerAdapterType('memory', MemoryExternalSystemAdapter);
      
      const types = factory.getAvailableAdapterTypes();
      expect(types).toContain('memory');
      expect(types.length).toBe(1);
    });
    
    it('should create an adapter of the specified type', () => {
      factory.registerAdapterType('memory', MemoryExternalSystemAdapter);
      
      const adapter = factory.createAdapter({
        type: 'memory',
        options: { name: 'test-memory' }
      });
      
      expect(adapter).toBeInstanceOf(MemoryExternalSystemAdapter);
    });
    
    it('should throw an error for unknown adapter types', () => {
      expect(() => factory.createAdapter({
        type: 'unknown',
        options: {}
      })).toThrow('Unknown adapter type: unknown');
    });
  });
  
  describe('externalSystemAdapterFactory singleton', () => {
    it('should be available as a singleton', () => {
      expect(externalSystemAdapterFactory).toBeDefined();
      expect(externalSystemAdapterFactory).toBeInstanceOf(ExternalSystemAdapterFactory);
    });
    
    it('should create adapters', () => {
      externalSystemAdapterFactory.registerAdapterType('memory', MemoryExternalSystemAdapter);
      
      const adapter = externalSystemAdapterFactory.createAdapter({
        type: 'memory',
        options: { name: 'test-singleton' }
      });
      
      expect(adapter).toBeInstanceOf(MemoryExternalSystemAdapter);
    });
  });
}); 