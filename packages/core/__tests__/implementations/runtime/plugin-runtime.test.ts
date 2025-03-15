import { createRuntime, ReactiveRuntime } from '../';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Plugin } from '../../../dsl/plugin';
import { Runtime } from '../../../models';

describe('Plugin Runtime', () => {
  let mockPlugin: Plugin;
  let runtime: ReactiveRuntime;
  
  beforeEach(() => {
    // Create a mock plugin
    mockPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      description: 'A test plugin',
      version: '1.0.0',
      initialize: vi.fn((runtime: Runtime) => {
        // Register a service
        runtime.registerService('test-service', {
          doSomething: () => 'test-result'
        });
      })
    };
    
    // Create runtime with the plugin
    runtime = createRuntime(
      {}, // No processes
      {}, // No tasks
      { plugins: [mockPlugin] }
    );
  });
  
  it('should create a runtime with plugins', () => {
    // Assert
    expect(runtime).toBeDefined();
    expect(runtime).toBeInstanceOf(ReactiveRuntime);
  });
  
  it('should initialize plugins during runtime creation', () => {
    // Assert
    expect(mockPlugin.initialize).toHaveBeenCalledWith(runtime);
  });
  
  it('should register services from plugins', () => {
    // Act
    const service = runtime.getService('test-service');
    
    // Assert
    expect(service).toBeDefined();
    expect(service.doSomething()).toBe('test-result');
  });
  
  it('should allow registering plugins after runtime creation', () => {
    // Arrange
    const newPlugin: Plugin = {
      id: 'new-plugin',
      name: 'New Plugin',
      description: 'A new plugin',
      version: '1.0.0',
      initialize: vi.fn((runtime: Runtime) => {
        runtime.registerService('new-service', {
          doSomething: () => 'new-result'
        });
      })
    };
    
    // Act
    runtime.registerPlugin(newPlugin);
    const service = runtime.getService('new-service');
    
    // Assert
    expect(newPlugin.initialize).toHaveBeenCalledWith(runtime);
    expect(service).toBeDefined();
    expect(service.doSomething()).toBe('new-result');
  });
  
  it('should allow retrieving plugins by ID', () => {
    // Act
    const plugin = runtime.getPlugin('test-plugin');
    
    // Assert
    expect(plugin).toBe(mockPlugin);
  });
  
  it('should return null for non-existent plugins', () => {
    // Act
    const plugin = runtime.getPlugin('non-existent');
    
    // Assert
    expect(plugin).toBeNull();
  });
}); 