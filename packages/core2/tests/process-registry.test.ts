import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleProcessRegistry } from '../src/implementations/process-registry';
import { ProcessDefinition } from '../src/models/process-system';
import { Result } from '../src/models/core-types';

describe('SimpleProcessRegistry', () => {
  let processRegistry: SimpleProcessRegistry;
  
  beforeEach(() => {
    processRegistry = new SimpleProcessRegistry();
  });
  
  describe('Process Registration', () => {
    const validProcessDefinition: ProcessDefinition<'created' | 'running' | 'completed'> = {
      id: 'test-process-1',
      name: 'Test Process',
      description: 'A test process definition',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'running', on: 'start' },
        { from: 'running', to: 'completed', on: 'complete' }
      ],
      version: '1.0.0'
    };
    
    it('should register a valid process definition', () => {
      const result = processRegistry.registerProcess(validProcessDefinition);
      
      expect(result.success).toBe(true);
      expect(processRegistry.hasProcessDefinition(validProcessDefinition.id)).toBe(true);
    });
    
    it('should not register a process without an ID', () => {
      const invalidProcess = { ...validProcessDefinition, id: '' };
      const result = processRegistry.registerProcess(invalidProcess);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('must have an ID');
      }
    });
    
    it('should not register a process without an initial state', () => {
      const invalidProcess = { ...validProcessDefinition, initialState: undefined as any };
      const result = processRegistry.registerProcess(invalidProcess);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('must have an initial state');
      }
    });
    
    it('should not register a process with a duplicate ID', () => {
      // Register the process first time
      processRegistry.registerProcess(validProcessDefinition);
      
      // Try to register again with same ID
      const result = processRegistry.registerProcess(validProcessDefinition);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('already registered');
      }
    });
  });
  
  describe('Process Retrieval', () => {
    const processDefinition1: ProcessDefinition = {
      id: 'test-process-1',
      name: 'Test Process 1',
      description: 'First test process definition',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'completed', on: 'complete' }
      ],
      version: '1.0.0'
    };
    
    const processDefinition2: ProcessDefinition = {
      id: 'test-process-2',
      name: 'Test Process 2',
      description: 'Second test process definition',
      initialState: 'pending',
      transitions: [
        { from: 'pending', to: 'active', on: 'activate' },
        { from: 'active', to: 'done', on: 'finish' }
      ],
      version: '1.0.0'
    };
    
    beforeEach(() => {
      processRegistry.registerProcess(processDefinition1);
      processRegistry.registerProcess(processDefinition2);
    });
    
    it('should retrieve a process definition by ID', () => {
      const result = processRegistry.getProcessDefinition(processDefinition1.id);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe(processDefinition1.id);
        expect(result.value.name).toBe(processDefinition1.name);
      }
    });
    
    it('should return an error for non-existent process ID', () => {
      const result = processRegistry.getProcessDefinition('non-existent');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('not found');
      }
    });
    
    it('should check if a process definition exists', () => {
      expect(processRegistry.hasProcessDefinition(processDefinition1.id)).toBe(true);
      expect(processRegistry.hasProcessDefinition('non-existent')).toBe(false);
    });
    
    it('should retrieve all process definitions', () => {
      const allDefinitions = processRegistry.getAllProcessDefinitions();
      
      expect(allDefinitions).toHaveLength(2);
      expect(allDefinitions.some(def => def.id === processDefinition1.id)).toBe(true);
      expect(allDefinitions.some(def => def.id === processDefinition2.id)).toBe(true);
    });
  });
  
  describe('Process Unregistration', () => {
    const processDefinition: ProcessDefinition = {
      id: 'test-process',
      name: 'Test Process',
      description: 'A test process definition',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'completed', on: 'complete' }
      ]
    };
    
    beforeEach(() => {
      processRegistry.registerProcess(processDefinition);
    });
    
    it('should unregister a process definition', () => {
      const result = processRegistry.unregisterProcess(processDefinition.id);
      
      expect(result.success).toBe(true);
      expect(processRegistry.hasProcessDefinition(processDefinition.id)).toBe(false);
    });
    
    it('should return an error when unregistering a non-existent process', () => {
      const result = processRegistry.unregisterProcess('non-existent');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('not registered');
      }
    });
  });
  
  describe('Process Definition By Type', () => {
    const processV1: ProcessDefinition = {
      id: 'order-process-v1',
      name: 'Order Process',
      description: 'Order processing workflow',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'completed', on: 'complete' }
      ],
      version: '1.0.0'
    };
    
    const processV2: ProcessDefinition = {
      id: 'order-process-v2',
      name: 'Order Process',
      description: 'Order processing workflow (improved)',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'processing', on: 'process' },
        { from: 'processing', to: 'completed', on: 'complete' }
      ],
      version: '2.0.0'
    };
    
    beforeEach(() => {
      processRegistry.registerProcess(processV1);
      processRegistry.registerProcess(processV2);
    });
    
    it('should retrieve a process definition by type', () => {
      const process = processRegistry.getProcessDefinitionByType('Order Process');
      
      expect(process).toBeDefined();
      // Should return the latest version by default
      expect(process?.version).toBe('2.0.0');
    });
    
    it('should retrieve a process definition by type and version', () => {
      const processV1Result = processRegistry.getProcessDefinitionByType('Order Process', '1.0.0');
      const processV2Result = processRegistry.getProcessDefinitionByType('Order Process', '2.0.0');
      
      expect(processV1Result).toBeDefined();
      expect(processV1Result?.id).toBe('order-process-v1');
      expect(processV1Result?.version).toBe('1.0.0');
      
      expect(processV2Result).toBeDefined();
      expect(processV2Result?.id).toBe('order-process-v2');
      expect(processV2Result?.version).toBe('2.0.0');
    });
    
    it('should return undefined for non-existent process type', () => {
      const process = processRegistry.getProcessDefinitionByType('Non-existent Process');
      expect(process).toBeUndefined();
    });
    
    it('should return undefined for non-existent version', () => {
      const process = processRegistry.getProcessDefinitionByType('Order Process', '3.0.0');
      expect(process).toBeUndefined();
    });
  });
}); 