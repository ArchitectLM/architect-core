import { Component, ComponentImplementation, ComponentSearchCriteria, ComponentType, ImplementationMetadata, SystemDefinition } from './types.js';
import { ComponentRegistry } from './component-registry.js';
import { SystemLoader, LoadedSystem } from './system-loader.js';

/**
 * System API for defining and working with components and systems
 */
export class SystemAPI {
  private registry: ComponentRegistry;
  private loader: SystemLoader;
  private systems: Map<string, LoadedSystem>;
  private implementations: Map<string, ComponentImplementation>;

  /**
   * Constructor
   */
  constructor() {
    this.registry = new ComponentRegistry();
    this.loader = new SystemLoader(this.registry);
    this.systems = new Map();
    this.implementations = new Map();
  }

  /**
   * Reset the System API (for testing)
   */
  reset(): void {
    this.registry = new ComponentRegistry();
    this.loader = new SystemLoader(this.registry);
    this.systems = new Map();
    this.implementations = new Map();
  }

  /**
   * Define a component
   * @param name Name of the component
   * @param definition Component definition
   * @returns The registered component
   */
  component<T extends Component>(name: string, definition: Omit<T, 'name'>): T {
    const component = {
      ...definition,
      name
    } as T;

    this.registry.register(component);
    return component;
  }

  /**
   * Define a system
   * @param name Name of the system
   * @param definition System definition
   * @returns The loaded system
   */
  define(name: string, definition: Omit<SystemDefinition, 'name'>): LoadedSystem {
    const systemDef: SystemDefinition = {
      ...definition,
      name
    };

    const system = this.loader.loadSystem(systemDef);
    this.systems.set(name, system);
    return system;
  }

  /**
   * Implement a component
   * @param componentName Name of the component to implement
   * @param implementation Implementation function
   * @param metadata Optional metadata
   * @returns The component implementation
   */
  implement<T = any, R = any>(
    componentName: string,
    implementation: (input: T, context: any) => Promise<R>,
    metadata?: ImplementationMetadata
  ): ComponentImplementation<T, R> {
    // Check if the component exists
    const component = this.registry.getComponent(componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }

    const impl: ComponentImplementation<T, R> = {
      componentName,
      implementation,
      metadata
    };

    this.implementations.set(componentName, impl);
    return impl;
  }

  /**
   * Execute a component implementation
   * @param componentName Name of the component to execute
   * @param input Input data
   * @param context Optional context
   * @returns The execution result
   */
  async execute<T = any, R = any>(
    componentName: string,
    input: T,
    context: any = {}
  ): Promise<R> {
    // Check if the component exists
    const component = this.registry.getComponent(componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }

    // Check if the component has an implementation
    const implementation = this.implementations.get(componentName) as ComponentImplementation<T, R>;
    if (!implementation) {
      throw new Error(`No implementation found for component ${componentName}`);
    }

    // Execute the implementation
    return implementation.implementation(input, context);
  }

  /**
   * Get a component by name
   * @param name Name of the component
   * @returns The component or undefined if not found
   */
  getComponent(name: string): Component | undefined {
    return this.registry.getComponent(name);
  }

  /**
   * Get a system by name
   * @param name Name of the system
   * @returns The system or undefined if not found
   */
  getSystem(name: string): LoadedSystem | undefined {
    return this.systems.get(name);
  }

  /**
   * Get a component implementation by name
   * @param name Name of the component
   * @returns The implementation or undefined if not found
   */
  getImplementation<T = any, R = any>(name: string): ComponentImplementation<T, R> | undefined {
    return this.implementations.get(name) as ComponentImplementation<T, R> | undefined;
  }

  /**
   * Find components matching the given criteria
   * @param criteria Search criteria
   * @returns Array of matching components
   */
  findComponents(criteria: Partial<ComponentSearchCriteria>): Component[] {
    return this.registry.findComponents(criteria);
  }

  /**
   * Get all components
   * @returns Array of all components
   */
  getAllComponents(): Component[] {
    return this.registry.getAllComponents();
  }

  /**
   * Get all systems
   * @returns Array of all systems
   */
  getAllSystems(): LoadedSystem[] {
    return Array.from(this.systems.values());
  }

  /**
   * Validate a system definition
   * @param systemDef System definition to validate
   * @returns Array of validation errors, empty if valid
   */
  validateSystem(systemDef: SystemDefinition): string[] {
    return this.loader.validateSystem(systemDef);
  }

  /**
   * Detect circular dependencies in the component graph
   * @param startComponentName Name of the component to start from
   * @returns Array of circular dependency paths
   */
  detectCircularDependencies(startComponentName: string): string[][] {
    return this.loader.detectCircularDependencies(startComponentName);
  }
}

/**
 * Singleton instance of the System API
 */
export const System = new SystemAPI(); 