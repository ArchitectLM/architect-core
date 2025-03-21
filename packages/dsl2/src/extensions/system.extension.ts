/**
 * System extension for the DSL
 * 
 * Adds system management capabilities to the DSL, allowing components to be organized
 * into cohesive systems with defined boundaries and relationships.
 */
import { DSL, DSLExtension } from '../core/dsl.js';
import { ComponentType, SystemDefinition } from '../models/component.js';

/**
 * System extension options
 */
export interface SystemExtensionOptions {
  /**
   * Whether to validate component references
   */
  validateReferences?: boolean;
  
  /**
   * Automatic dependency resolution
   */
  autoDependencyResolution?: boolean;
  
  /**
   * Default system options
   */
  defaultSystemOptions?: Partial<SystemDefinition>;
}

/**
 * System Extension Implementation
 */
export class SystemExtension implements DSLExtension {
  id = 'system';
  private dsl: DSL | null = null;
  private options: SystemExtensionOptions = {};
  private systems: Map<string, SystemDefinition> = new Map();
  
  init(dsl: DSL, options: SystemExtensionOptions = {}): void {
    this.dsl = dsl;
    
    // Default options
    const defaultOptions: SystemExtensionOptions = {
      validateReferences: true,
      autoDependencyResolution: false,
      defaultSystemOptions: {
        version: '1.0.0'
      }
    };
    
    // Merge options
    this.options = { ...defaultOptions, ...options };
    
    // Add extension methods to the DSL
    this.extendDsl(dsl);
    
    console.log('System extension initialized with options:', this.options);
  }

  cleanup(): void {
    this.dsl = null;
    this.systems.clear();
    console.log('System extension cleaned up');
  }
  
  /**
   * Extend DSL with system-specific methods
   */
  private extendDsl(dsl: DSL): void {
    // Add system creation method
    (dsl as any).system = (id: string, definition: Omit<SystemDefinition, 'id' | 'type'>) => {
      return this.createSystem(id, definition);
    };
    
    // Add system retrieval method
    (dsl as any).getSystem = (id: string) => {
      return this.getSystem(id);
    };
    
    // Add method to get all systems
    (dsl as any).getAllSystems = () => {
      return Array.from(this.systems.values());
    };
    
    // Add method to check component dependencies
    (dsl as any).validateSystemReferences = (systemId: string) => {
      return this.validateSystemReferences(systemId);
    };
  }
  
  /**
   * Create a new system definition
   */
  private createSystem(id: string, definition: Omit<SystemDefinition, 'id' | 'type'>): SystemDefinition {
    if (!this.dsl) {
      throw new Error('DSL instance not available');
    }
    
    // Create full system definition
    const system: SystemDefinition = {
      id,
      type: ComponentType.SYSTEM,
      ...this.options.defaultSystemOptions,
      ...definition,
      components: definition.components || {}
    };
    
    // Validate component references if enabled
    if (this.options.validateReferences) {
      this.validateSystemReferences(system);
    }
    
    // Register the system
    this.systems.set(id, system);
    
    // Register as a component too for consistency
    this.dsl.component(id, {
      type: ComponentType.SYSTEM,
      description: system.description,
      version: system.version
    });
    
    // Make system properties accessible from component
    const component = this.dsl.getComponent(id);
    if (component) {
      Object.assign(component, {
        components: system.components,
        tenancy: system.tenancy,
        security: system.security,
        observability: system.observability
      });
    }
    
    return system;
  }
  
  /**
   * Get a system by ID
   */
  private getSystem(id: string): SystemDefinition | undefined {
    return this.systems.get(id);
  }
  
  /**
   * Validate that all component references in a system exist
   */
  private validateSystemReferences(system: SystemDefinition | string): string[] {
    if (!this.dsl) {
      throw new Error('DSL instance not available');
    }
    
    // Get system by ID if string was provided
    const systemDef = typeof system === 'string' 
      ? this.systems.get(system) 
      : system;
    
    if (!systemDef) {
      throw new Error(`System not found: ${system}`);
    }
    
    const errors: string[] = [];
    const components = systemDef.components || {};
    
    // Check each component type
    Object.entries(components).forEach(([type, refs]) => {
      if (!refs) return;
      
      refs.forEach(ref => {
        const componentId = ref.ref;
        const component = this.dsl?.getComponent(componentId);
        
        if (!component) {
          errors.push(`Component not found: ${componentId} referenced in ${systemDef.id}`);
        }
      });
    });
    
    // If errors were found and validation is enabled, throw error
    if (errors.length > 0 && this.options.validateReferences) {
      throw new Error(`System validation failed: ${errors.join(', ')}`);
    }
    
    return errors;
  }
  
  /**
   * Auto-detect dependencies for a system
   */
  private autoDetectDependencies(systemId: string): void {
    if (!this.dsl || !this.options.autoDependencyResolution) return;
    
    const system = this.systems.get(systemId);
    if (!system) return;
    
    // This would implement dependency scanning between components
    // For example, if a command references a schema, the schema would be included
    // in the system's components automatically.
    
    console.log(`Auto-detected dependencies for system ${systemId}`);
  }
}

/**
 * Setup function for the system extension
 */
export function setupSystemExtension(dsl: DSL, options: SystemExtensionOptions = {}): void {
  const extension = new SystemExtension();
  dsl.registerExtension(extension, options);
} 