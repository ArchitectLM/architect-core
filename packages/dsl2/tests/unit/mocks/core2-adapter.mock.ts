import { vi } from 'vitest';
import { ComponentDefinition, ComponentType } from '../../../src/models/component.js';

/**
 * Mock Core2 adapter for testing DSL to runtime integration
 */
export class MockCore2Adapter {
  public createActorSystem = vi.fn().mockResolvedValue({
    rootActor: { id: 'root-actor' },
    start: vi.fn().mockResolvedValue(true),
    stop: vi.fn().mockResolvedValue(true),
    getActor: vi.fn().mockImplementation((id: string) => ({ id, tell: vi.fn() }))
  });

  public convertDefinitionToRuntime = vi.fn().mockImplementation((def: ComponentDefinition) => {
    // Mock implementation that transforms DSL definitions to Core2 runtime configs
    return {
      id: def.id,
      type: def.type,
      // Add runtime-specific properties
      runtime: {
        instanceId: `instance-${def.id}`,
        deployedAt: new Date().toISOString()
      },
      // Process attributes for specialized behavior
      attributes: this.processAttributes(def),
      // Apply policies
      policies: this.processPolicies(def),
      // Process behaviors
      behaviors: this.processBehaviors(def)
    };
  });

  /**
   * Process component attributes for specialized runtime behavior
   */
  private processAttributes(def: ComponentDefinition) {
    if (!def.attributes) return {};

    const result: Record<string, any> = {};
    
    // Handle event sourcing attribute
    if (def.attributes.eventSourced && def.type === ComponentType.ACTOR) {
      result.eventSourced = {
        ...def.attributes.eventSourced,
        // Add runtime-specific configurations
        journalProvider: 'in-memory',
        snapshotStorage: 'in-memory'
      };
    }
    
    // Handle CQRS attribute
    if (def.attributes.cqrs && def.type === ComponentType.SYSTEM) {
      result.cqrs = {
        ...def.attributes.cqrs,
        // Add runtime-specific configurations
        eventBusImpl: 'in-memory',
        readModelSync: 'immediate'
      };
    }
    
    // Handle message bus attribute
    if (def.attributes.messageBus && def.type === ComponentType.PROCESS) {
      result.messageBus = {
        ...def.attributes.messageBus,
        // Add runtime-specific configurations
        provider: 'in-memory',
        queueSize: 1000
      };
    }
    
    return result;
  }

  /**
   * Process component policies for runtime application
   */
  private processPolicies(def: ComponentDefinition) {
    if (!def.policies) return {};
    
    const result: Record<string, any> = {};
    
    // Process retry policies
    if (def.policies.retry) {
      result.retry = {
        ...def.policies.retry,
        // Add runtime-specific configurations
        implementation: 'default-retry-provider'
      };
    }
    
    // Process circuit breaker policies
    if (def.policies.circuitBreaker) {
      result.circuitBreaker = {
        ...def.policies.circuitBreaker,
        // Add runtime-specific configurations
        implementation: 'default-circuit-breaker'
      };
    }
    
    // Process timeout policies
    if (def.policies.timeout) {
      result.timeout = {
        ...def.policies.timeout,
        // Add runtime-specific configurations
        implementation: 'default-timeout-provider'
      };
    }
    
    return result;
  }

  /**
   * Process component behaviors for runtime composition
   */
  private processBehaviors(def: ComponentDefinition) {
    if (!def.behaviors || !Array.isArray(def.behaviors)) return [];
    
    // In a real implementation, this would load and merge behavior definitions
    return def.behaviors.map(behavior => ({
      ref: behavior.ref,
      // Add runtime-specific configurations
      applied: true,
      appliedAt: new Date().toISOString()
    }));
  }
} 