import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType, ComponentDefinition, ComponentReference } from '../../src/models/component.js';

// Mock core2 adapter
const mockCore2Adapter = {
  createActorSystem: vi.fn().mockResolvedValue({
    rootActor: { id: 'root-actor' },
    start: vi.fn().mockResolvedValue(true),
    stop: vi.fn().mockResolvedValue(true),
    getActor: vi.fn().mockImplementation((id: string) => ({ id, tell: vi.fn() }))
  }),
  convertDefinitionToRuntime: vi.fn().mockImplementation((def: ComponentDefinition) => {
    // Simple mock implementation that returns a transformed definition
    // In reality, this would convert DSL components to core2 runtime config
    return {
      id: def.id,
      type: def.type,
      // Add runtime-specific properties
      runtime: {
        instanceId: `instance-${def.id}`,
        deployedAt: new Date().toISOString()
      },
      // Process attributes for specialized behavior
      attributes: def.attributes || {},
      // Apply policies
      policies: def.policies || {},
      // Process implementations if available
      implementation: def.type === ComponentType.IMPLEMENTATION ? 
        { targetComponent: def.targetComponent, handlers: Object.keys(def.handlers || {}) } : undefined
    };
  })
};

describe('Simplified DSL Integration with Core2', () => {
  let dsl: DSL;
  
  beforeEach(() => {
    dsl = new DSL();
    vi.clearAllMocks();
  });
  
  describe('Runtime Integration with Unified Component Approach', () => {
    it('should handle component implementations defined through the unified approach', async () => {
      // Define a schema
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['id', 'name']
      });
      
      // Define an actor
      dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'User management actor',
        version: '1.0.0',
        attributes: {
          domain: 'user-management'
        },
        messageHandlers: {
          createUser: {
            input: { /* schema */ },
            output: { ref: 'User' }
          }
        }
      });
      
      // Define implementation directly with component
      const userActorImpl = dsl.component('UserActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Implementation of UserActor',
        version: '1.0.0',
        targetComponent: 'UserActor',
        attributes: {
          domain: 'user-management'
        },
        handlers: {
          createUser: async (input: any, context: any) => {
            return { id: 'user-1', name: input.name, email: input.email };
          }
        }
      });
      
      // Define a test
      const userActorTest = dsl.component('UserActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for UserActor',
        version: '1.0.0',
        target: { ref: 'UserActor' },
        attributes: {
          domain: 'user-management'
        },
        scenarios: [
          {
            name: 'Create user test',
            given: [{ setup: 'emptyState' }],
            when: [{ send: { message: 'createUser', payload: { name: 'Test', email: 'test@example.com' } } }],
            then: [{ assert: 'result.name', equals: 'Test' }]
          }
        ]
      });
      
      // Define system
      const system = dsl.system('UserSystem', {
        description: 'User management system',
        version: '1.0.0',
        attributes: {
          domain: 'user-management'
        },
        components: {
          schemas: [{ ref: 'User' }],
          actors: [{ ref: 'UserActor' }]
        }
      });
      
      // Get all related components by domain attribute
      const domainComponents = Array.from(dsl['components'].values())
        .filter(comp => comp.attributes?.domain === 'user-management');
      
      // Convert related components to runtime
      const runtimeConfigs = domainComponents.map(comp => 
        mockCore2Adapter.convertDefinitionToRuntime(comp)
      );
      
      // Create actor system for the main system component
      const systemRuntimeConfig = mockCore2Adapter.convertDefinitionToRuntime(system);
      const actorSystem = await mockCore2Adapter.createActorSystem(systemRuntimeConfig);
      
      // Verify domain components were properly identified
      expect(domainComponents.length).toBe(4); // schema, actor, implementation, test
      
      // Verify implementation was processed correctly
      const implConfig = runtimeConfigs.find(cfg => cfg.type === ComponentType.IMPLEMENTATION);
      expect(implConfig).toBeDefined();
      expect(implConfig?.implementation?.targetComponent).toBe('UserActor');
      expect(implConfig?.implementation?.handlers).toContain('createUser');
      
      // Verify test was processed
      const testConfig = runtimeConfigs.find(cfg => cfg.type === ComponentType.TEST);
      expect(testConfig).toBeDefined();
      
      // Verify actor system creation
      expect(mockCore2Adapter.createActorSystem).toHaveBeenCalledWith(systemRuntimeConfig);
      expect(actorSystem).toBeDefined();
      expect(actorSystem.rootActor).toBeDefined();
    });
    
    it('should process implementation attributes, behaviors, and policies', async () => {
      // Define an actor with behaviors and policies
      dsl.component('ComplexActor', {
        type: ComponentType.ACTOR,
        description: 'Actor with complex behaviors',
        version: '1.0.0',
        attributes: {
          eventSourced: { enabled: true }
        },
        policies: {
          retry: { default: { attempts: 3 } }
        },
        messageHandlers: {
          processMessage: { /* handler definition */ }
        }
      });
      
      // Define implementation with its own attributes
      const actorImpl = dsl.component('ComplexActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Implementation with attributes',
        version: '1.0.0',
        targetComponent: 'ComplexActor',
        attributes: {
          tracking: { enabled: true, level: 'debug' },
          metrics: { collect: true, namespace: 'example' }
        },
        handlers: {
          processMessage: async (input: any, context: any) => {
            return { processed: true };
          }
        }
      });
      
      // Convert to runtime config using both component and implementation attributes
      const runtimeConfig = mockCore2Adapter.convertDefinitionToRuntime(actorImpl);
      
      // Verify implementation attributes are included
      expect(runtimeConfig.attributes).toBeDefined();
      expect(runtimeConfig.attributes.tracking).toBeDefined();
      expect(runtimeConfig.attributes.tracking.enabled).toBe(true);
      expect(runtimeConfig.attributes.metrics).toBeDefined();
      
      // In a real implementation, we'd expect Core2 to merge component attributes
      // from the target component with the implementation attributes
    });
  });
}); 