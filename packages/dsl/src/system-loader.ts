import { Component, ComponentRef, SystemDefinition } from './types.js';
import { ComponentRegistry } from './component-registry.js';

/**
 * Interface for a loaded system
 */
export interface LoadedSystem extends SystemDefinition {
  /**
   * Map of loaded components
   */
  loadedComponents: Map<string, Component>;
}

/**
 * System loader for loading and resolving component references
 */
export class SystemLoader {
  /**
   * Constructor
   * @param registry Component registry to use for loading components
   */
  constructor(private registry: ComponentRegistry) {}

  /**
   * Load a system definition and resolve all component references
   * @param systemDef System definition to load
   * @returns Loaded system with resolved components
   * @throws Error if a required component is not found
   */
  loadSystem(systemDef: SystemDefinition): LoadedSystem {
    const loadedComponents = new Map<string, Component>();

    // Process schemas
    if (systemDef.components.schemas) {
      this.processComponentRefs(systemDef.components.schemas, loadedComponents);
    }

    // Process commands
    if (systemDef.components.commands) {
      this.processComponentRefs(systemDef.components.commands, loadedComponents);
    }

    // Process queries
    if (systemDef.components.queries) {
      this.processComponentRefs(systemDef.components.queries, loadedComponents);
    }

    // Process events
    if (systemDef.components.events) {
      this.processComponentRefs(systemDef.components.events, loadedComponents);
    }

    // Process workflows
    if (systemDef.components.workflows) {
      this.processComponentRefs(systemDef.components.workflows, loadedComponents);
    }

    return {
      ...systemDef,
      loadedComponents
    };
  }

  /**
   * Process component references and load them into the map
   * @param refs Component references to process
   * @param loadedComponents Map to store loaded components
   * @throws Error if a required component is not found
   */
  private processComponentRefs(refs: ComponentRef[], loadedComponents: Map<string, Component>): void {
    for (const ref of refs) {
      const component = this.registry.getComponent(ref.ref);
      
      if (!component) {
        if (ref.required) {
          throw new Error(`Required component ${ref.ref} not found`);
        }
      } else {
        loadedComponents.set(ref.ref, component);
      }
    }
  }

  /**
   * Get a component by name, loading it if necessary
   * @param name Component name
   * @returns The component
   * @throws Error if the component is not found
   */
  async getComponent(name: string): Promise<Component> {
    // Check if the component is already in the registry
    const component = this.registry.getComponent(name);
    if (component) {
      return component;
    }

    // If not, try to load it from its path
    const componentPath = this.getComponentPath(name);
    if (componentPath) {
      return this.loadComponentFromPath(componentPath);
    }

    throw new Error(`Component ${name} not found`);
  }

  /**
   * Get the path for a component
   * @param name Component name
   * @returns The component path or undefined if not found
   */
  private getComponentPath(name: string): string | undefined {
    // This would typically come from a component registry or configuration
    // For now, we'll use a simple convention: components/{type}/{name}.js
    const component = this.registry.getComponent(name);
    return component?.path;
  }

  /**
   * Load a component from a file path
   * @param path Path to the component file
   * @returns The loaded component
   * @throws Error if the component file does not export a default component
   */
  async loadComponentFromPath(path: string): Promise<Component> {
    try {
      // Dynamic import of the component file
      const module = await import(path);
      
      if (!module.default) {
        throw new Error(`Component file ${path} does not export a default component`);
      }
      
      const component = module.default as Component;
      
      // Register the component in the registry
      this.registry.register(component);
      
      return component;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load component from ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Detect circular dependencies in the component graph
   * @param startComponentName Name of the component to start from
   * @returns Array of circular dependency paths
   */
  detectCircularDependencies(startComponentName: string): string[][] {
    const visited = new Set<string>();
    const path: string[] = [];
    const cycles: string[][] = [];

    const dfs = (componentName: string) => {
      // If we've already seen this component in the current path, we have a cycle
      const cycleIndex = path.indexOf(componentName);
      if (cycleIndex !== -1) {
        cycles.push([...path.slice(cycleIndex), componentName]);
        return;
      }

      // If we've already visited this component in another path, skip it
      if (visited.has(componentName)) {
        return;
      }

      // Get the component
      const component = this.registry.getComponent(componentName);
      if (!component) {
        return;
      }

      // Add to visited and current path
      visited.add(componentName);
      path.push(componentName);

      // Visit all related components
      if (component.relatedComponents) {
        for (const related of component.relatedComponents) {
          dfs(related.ref);
        }
      }

      // Remove from current path
      path.pop();
    };

    dfs(startComponentName);
    return cycles;
  }

  /**
   * Validate a system definition
   * @param systemDef System definition to validate
   * @returns Array of validation errors, empty if valid
   */
  validateSystem(systemDef: SystemDefinition): string[] {
    const errors: string[] = [];

    // Check for required fields
    if (!systemDef.name) {
      errors.push('System name is required');
    }

    // Check for required components
    if (systemDef.components.schemas) {
      for (const ref of systemDef.components.schemas) {
        if (ref.required && !this.registry.hasComponent(ref.ref)) {
          errors.push(`Required schema component ${ref.ref} not found`);
        }
      }
    }

    if (systemDef.components.commands) {
      for (const ref of systemDef.components.commands) {
        if (ref.required && !this.registry.hasComponent(ref.ref)) {
          errors.push(`Required command component ${ref.ref} not found`);
        }
      }
    }

    if (systemDef.components.queries) {
      for (const ref of systemDef.components.queries) {
        if (ref.required && !this.registry.hasComponent(ref.ref)) {
          errors.push(`Required query component ${ref.ref} not found`);
        }
      }
    }

    if (systemDef.components.events) {
      for (const ref of systemDef.components.events) {
        if (ref.required && !this.registry.hasComponent(ref.ref)) {
          errors.push(`Required event component ${ref.ref} not found`);
        }
      }
    }

    if (systemDef.components.workflows) {
      for (const ref of systemDef.components.workflows) {
        if (ref.required && !this.registry.hasComponent(ref.ref)) {
          errors.push(`Required workflow component ${ref.ref} not found`);
        }
      }
    }

    // Check for circular dependencies
    const allComponents = new Set<string>();
    
    // Collect all component references
    const collectRefs = (refs: ComponentRef[] | undefined) => {
      if (!refs) return;
      for (const ref of refs) {
        allComponents.add(ref.ref);
      }
    };

    collectRefs(systemDef.components.schemas);
    collectRefs(systemDef.components.commands);
    collectRefs(systemDef.components.queries);
    collectRefs(systemDef.components.events);
    collectRefs(systemDef.components.workflows);

    // Check each component for circular dependencies
    for (const componentName of allComponents) {
      const cycles = this.detectCircularDependencies(componentName);
      for (const cycle of cycles) {
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }
    }

    return errors;
  }
} 