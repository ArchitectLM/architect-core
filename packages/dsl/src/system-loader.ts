/**
 * System Loader
 * 
 * This module provides functionality for loading and validating systems
 * with support for both lazy loading and critical path initialization.
 */

import { ComponentRegistry } from './component-registry.js';
import { 
  Component, 
  ComponentRef, 
  ComponentType, 
  SystemDefinition
} from './types.js';
import { ReactiveEventBus } from '@architectlm/core';
import { DSLEventType } from './event-driven-dsl-compiler.js';
import { ComponentCache, CacheOptions } from './component-cache.js';

/**
 * Represents a loaded system
 */
export interface LoadedSystem {
  /**
   * Name of the system
   */
  name: string;
  
  /**
   * Description of the system
   */
  description?: string;
  
  /**
   * Components in the system
   */
  components: {
    schemas: ComponentRef[];
    commands: ComponentRef[];
    queries: ComponentRef[];
    events: ComponentRef[];
    workflows: ComponentRef[];
  };
  
  /**
   * Map of loaded components
   */
  loadedComponents: Map<string, Component>;
  
  /**
   * Validation status
   */
  validationStatus: {
    isValid: boolean;
    errors: string[];
    lastValidated: Date;
  };
}

/**
 * System loader options
 */
export interface SystemLoaderOptions {
  /**
   * Whether to use lazy loading (default: true)
   */
  useLazyLoading?: boolean;
  
  /**
   * Event bus for system events
   */
  eventBus?: ReactiveEventBus;
  
  /**
   * Cache options for component loading
   */
  cacheOptions?: CacheOptions;
  
  /**
   * Critical path components to always load at startup
   * Format: { componentType: ['componentName1', 'componentName2'] }
   */
  criticalPathComponents?: Partial<Record<ComponentType, string[]>>;
  
  /**
   * Whether to validate components on load (default: true)
   */
  validateOnLoad?: boolean;
  
  /**
   * Whether to preload all components in background after system initialization (default: false)
   */
  preloadAllInBackground?: boolean;
}

/**
 * System loader
 */
export class SystemLoader {
  private registry: ComponentRegistry;
  private eventBus?: ReactiveEventBus;
  private options: {
    useLazyLoading: boolean;
    eventBus?: ReactiveEventBus;
    cacheOptions: CacheOptions;
    criticalPathComponents: Partial<Record<ComponentType, string[]>>;
    validateOnLoad: boolean;
    preloadAllInBackground: boolean;
  };
  private componentCache: ComponentCache<Component>;
  private loadedSystems: Map<string, LoadedSystem> = new Map();
  private loadingPromises: Map<string, Promise<Component>> = new Map();
  private backgroundLoadQueue: string[] = [];
  private isBackgroundLoading = false;
  
  /**
   * Constructor
   * @param registry Component registry
   * @param options System loader options
   */
  constructor(registry: ComponentRegistry, options: SystemLoaderOptions = {}) {
    this.registry = registry;
    this.eventBus = options.eventBus;
    
    // Set default options
    this.options = {
      useLazyLoading: options.useLazyLoading !== false,
      eventBus: options.eventBus,
      cacheOptions: options.cacheOptions || {
        ttl: 3600000, // 1 hour
        maxEntries: 1000,
        slidingExpiration: true
      },
      criticalPathComponents: options.criticalPathComponents || {
        [ComponentType.SCHEMA]: [],
        [ComponentType.COMMAND]: [],
        [ComponentType.EVENT]: [],
        [ComponentType.QUERY]: [],
        [ComponentType.WORKFLOW]: []
      },
      validateOnLoad: options.validateOnLoad !== false,
      preloadAllInBackground: options.preloadAllInBackground || false
    };
    
    // Initialize component cache
    this.componentCache = new ComponentCache<Component>(this.options.cacheOptions);
  }
  
  /**
   * Load a system definition
   * @param systemDef System definition
   * @returns The loaded system
   */
  loadSystem(systemDef: SystemDefinition): LoadedSystem {
    // Validate the system definition
    const validationErrors = this.validateSystem(systemDef);
    
    // Check for required components
    for (const schemaRef of systemDef.components.schemas || []) {
      if (schemaRef.required && !this.registry.getComponent(schemaRef.ref)) {
        throw new Error(`Required component ${schemaRef.ref} not found`);
      }
    }
    
    for (const commandRef of systemDef.components.commands || []) {
      if (commandRef.required && !this.registry.getComponent(commandRef.ref)) {
        throw new Error(`Required component ${commandRef.ref} not found`);
      }
    }
    
    // Create the loaded system
    const system: LoadedSystem = {
      name: systemDef.name,
      description: systemDef.description,
      components: {
        schemas: systemDef.components.schemas || [],
        commands: systemDef.components.commands || [],
        events: systemDef.components.events || [],
        queries: systemDef.components.queries || [],
        workflows: systemDef.components.workflows || []
      },
      loadedComponents: new Map(),
      validationStatus: {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        lastValidated: new Date()
      }
    };
    
    // Store the system
    this.loadedSystems.set(systemDef.name, system);
    
    // If not using lazy loading, load all components immediately
    if (!this.options.useLazyLoading) {
      this.loadAllComponents(system);
    } else {
      // Load critical path components
      this.loadCriticalPathComponents(system);
      
      // Optionally preload all components in background
      if (this.options.preloadAllInBackground) {
        this.scheduleBackgroundLoading(system);
      }
    }
    
    // Publish system loaded event
    if (this.eventBus) {
      this.eventBus.publish('DSL_SYSTEM_LOADED', {
        system: system.name,
        isLazyLoaded: this.options.useLazyLoading
      });
    }
    
    return system;
  }
  
  /**
   * Load all components for a system
   * @param system The system to load components for
   */
  private loadAllComponents(system: LoadedSystem): void {
    // Load all components
    this.loadComponentsOfType(system, ComponentType.SCHEMA, system.components.schemas);
    this.loadComponentsOfType(system, ComponentType.COMMAND, system.components.commands);
    this.loadComponentsOfType(system, ComponentType.EVENT, system.components.events);
    this.loadComponentsOfType(system, ComponentType.QUERY, system.components.queries);
    this.loadComponentsOfType(system, ComponentType.WORKFLOW, system.components.workflows);
  }
  
  /**
   * Load critical path components for a system
   * @param system The system to load critical path components for
   */
  private loadCriticalPathComponents(system: LoadedSystem): void {
    // Load critical path components for each type
    Object.entries(this.options.criticalPathComponents || {}).forEach(([type, names]) => {
      if (!names || !names.length) return;
      
      const componentType = type as ComponentType;
      const componentRefs = this.getComponentReferencesForType(system, componentType);
      
      if (!componentRefs) return;
      
      // Filter component references to only include critical path components and required components
      const criticalRefs = componentRefs.filter(ref => 
        names.includes(ref.ref) || ref.required === true
      );
      
      // Load the critical path components
      this.loadComponentsOfType(system, componentType, criticalRefs);
    });
  }
  
  /**
   * Schedule background loading of all components
   * @param system The system to load components for
   */
  private scheduleBackgroundLoading(system: LoadedSystem): void {
    // Add all component references to the background loading queue
    this.addToBackgroundQueue(system, ComponentType.SCHEMA, system.components.schemas);
    this.addToBackgroundQueue(system, ComponentType.COMMAND, system.components.commands);
    this.addToBackgroundQueue(system, ComponentType.EVENT, system.components.events);
    this.addToBackgroundQueue(system, ComponentType.QUERY, system.components.queries);
    this.addToBackgroundQueue(system, ComponentType.WORKFLOW, system.components.workflows);
    
    // Start background loading if not already in progress
    if (!this.isBackgroundLoading) {
      this.processBackgroundLoadQueue();
    }
  }
  
  /**
   * Add components to the background loading queue
   * @param system The system
   * @param type Component type
   * @param refs Component references
   */
  private addToBackgroundQueue(
    system: LoadedSystem, 
    type: ComponentType, 
    refs: ComponentRef[]
  ): void {
    // Skip components that are already loaded
    const notLoadedRefs = refs.filter(ref => !system.loadedComponents.has(ref.ref));
    
    // Add to queue
    notLoadedRefs.forEach(ref => {
      this.backgroundLoadQueue.push(ref.ref);
    });
  }
  
  /**
   * Process the background loading queue
   */
  private async processBackgroundLoadQueue(): Promise<void> {
    this.isBackgroundLoading = true;
    
    // Process queue with small delays to avoid blocking the main thread
    while (this.backgroundLoadQueue.length > 0) {
      const componentName = this.backgroundLoadQueue.shift();
      if (componentName) {
        try {
          // Load the component if not already loading
          if (!this.loadingPromises.has(componentName)) {
            const component = this.registry.getComponent(componentName);
            if (component) {
              // Cache the component
              this.componentCache.set(component, component);
            }
          }
        } catch (error) {
          console.warn(`Background loading failed for component ${componentName}:`, error);
        }
        
        // Small delay to avoid blocking the main thread
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    
    this.isBackgroundLoading = false;
  }
  
  /**
   * Get component references for a specific type
   * @param system The system
   * @param type Component type
   * @returns Array of component references
   */
  private getComponentReferencesForType(
    system: LoadedSystem, 
    type: ComponentType
  ): ComponentRef[] | undefined {
    switch (type) {
      case ComponentType.SCHEMA:
        return system.components.schemas;
      case ComponentType.COMMAND:
        return system.components.commands;
      case ComponentType.EVENT:
        return system.components.events;
      case ComponentType.QUERY:
        return system.components.queries;
      case ComponentType.WORKFLOW:
        return system.components.workflows;
      default:
        return undefined;
    }
  }
  
  /**
   * Load components of a specific type
   * @param system The system to load components for
   * @param componentType The type of components to load
   * @param componentRefs The component references to load
   */
  private loadComponentsOfType(system: LoadedSystem, componentType: ComponentType, componentRefs: ComponentRef[]): void {
    for (const ref of componentRefs) {
      const component = this.registry.getComponent(ref.ref);
      if (component) {
        system.loadedComponents.set(ref.ref, component);
      }
    }
  }
  
  /**
   * Validate a system definition
   * @param systemDef System definition to validate
   * @returns Array of validation errors
   */
  private validateSystem(systemDef: SystemDefinition): string[] {
    const errors: string[] = [];
    
    // Check required fields
    if (!systemDef.name) {
      errors.push('System name is required');
    }
    
    if (!systemDef.components) {
      errors.push('System components are required');
    }
    
    return errors;
  }
  
  /**
   * Get a system by name
   * @param name The name of the system to get
   * @returns The system or undefined if not found
   */
  getSystem(name: string): LoadedSystem | undefined {
    return this.loadedSystems.get(name);
  }
  
  /**
   * Get a component by name
   * @param name The name of the component to get
   * @returns The component
   */
  async getComponent(name: string): Promise<Component> {
    // Check if the component is in the cache
    const cachedComponent = this.componentCache.get({ name } as Component);
    if (cachedComponent) {
      return cachedComponent;
    }
    
    // Check if the component is in the registry
    const component = this.registry.getComponent(name);
    if (!component) {
      throw new Error(`Component ${name} not found`);
    }
    
    // Cache the component
    this.componentCache.set(component, component);
    
    return component;
  }
  
  /**
   * Invalidate the cache for a component
   * @param componentName Name of the component to invalidate
   */
  invalidateComponentCache(componentName: string): void {
    // Find in cache by name and remove
    for (const component of this.getAllCachedComponents()) {
      if (component.name === componentName) {
        this.componentCache.remove(component);
        break;
      }
    }
  }
  
  /**
   * Clear the component cache
   */
  clearCache(): void {
    this.componentCache.clear();
  }
  
  /**
   * Load a component from a file path
   * @param filePath Path to the component file
   * @returns The loaded component
   */
  async loadComponentFromPath(filePath: string): Promise<Component> {
    try {
      // Import the component file
      const module = await import(filePath);
      
      // Check if the module exports a default component
      if (!module.default) {
        throw new Error(`Component file ${filePath} does not export a default component`);
      }
      
      const component = module.default as Component;
      
      // Register the component
      this.registry.register(component);
      
      return component;
    } catch (error: any) {
      throw new Error(`Failed to load component from ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Get the dependencies of a component
   * @param component The component
   * @returns Array of component names that this component depends on
   */
  private getComponentDependencies(component: Component): string[] {
    const dependencies: string[] = [];
    
    // Check for dependencies based on component type
    switch (component.type) {
      case ComponentType.SCHEMA:
        // Schema dependencies are in the properties
        if (component.definition && component.definition.properties) {
          for (const [_, prop] of Object.entries(component.definition.properties)) {
            if (prop.ref) {
              dependencies.push(prop.ref);
            }
          }
        }
        break;
        
      case ComponentType.COMMAND:
      case ComponentType.QUERY:
        // Command and query dependencies are in input and output
        if (component.input && component.input.ref) {
          dependencies.push(component.input.ref);
        }
        if (component.output && component.output.ref) {
          dependencies.push(component.output.ref);
        }
        break;
        
      case ComponentType.EVENT:
        // Event dependencies are in the payload
        if (component.payload && component.payload.ref) {
          dependencies.push(component.payload.ref);
        }
        break;
        
      case ComponentType.WORKFLOW:
        // Workflow dependencies are in the steps
        if (component.steps) {
          for (const step of component.steps) {
            if ('ref' in step && step.ref) {
              dependencies.push(step.ref);
            }
          }
        }
        break;
    }
    
    return dependencies;
  }
  
  /**
   * Detect circular dependencies between components
   * @param startComponentName The name of the component to start from
   * @returns Array of circular dependency paths
   */
  detectCircularDependencies(startComponentName: string): string[][] {
    const visited = new Set<string>();
    const path: string[] = [];
    const circularDependencies: string[][] = [];
    
    const dfs = (componentName: string) => {
      // Get the component
      const component = this.registry.getComponent(componentName);
      if (!component) {
        return;
      }
      
      // Check if we've already visited this component in the current path
      const index = path.indexOf(componentName);
      if (index !== -1) {
        // We found a circular dependency
        circularDependencies.push([...path.slice(index), componentName]);
        return;
      }
      
      // Skip if we've already visited this component in another path
      if (visited.has(componentName)) {
        return;
      }
      
      // Mark as visited and add to path
      visited.add(componentName);
      path.push(componentName);
      
      // Visit related components
      if (component.relatedComponents) {
        for (const relatedComponent of component.relatedComponents) {
          dfs(relatedComponent.ref);
        }
      }
      
      // Remove from path when done
      path.pop();
    };
    
    // Start DFS from the specified component
    dfs(startComponentName);
    
    return circularDependencies;
  }
  
  /**
   * Get all cached components
   * @returns Array of cached components
   */
  private getAllCachedComponents(): Component[] {
    // This is a simplification - in a real implementation, we would need
    // a more efficient way to query the cache by component name
    const result: Component[] = [];
    // Implementation would depend on the actual ComponentCache API
    return result;
  }
  
  /**
   * Get a component from a specific system
   * @param systemName The name of the system
   * @param componentName The name of the component to get
   * @returns The component
   */
  async getSystemComponent(systemName: string, componentName: string): Promise<Component> {
    const system = this.getSystem(systemName);
    if (!system) {
      throw new Error(`System ${systemName} not found`);
    }
    
    // Check if the component is already loaded
    const loadedComponent = system.loadedComponents.get(componentName);
    if (loadedComponent) {
      return loadedComponent;
    }
    
    // Check if the component is in the cache
    const cachedComponent = this.componentCache.get({ name: componentName } as Component);
    if (cachedComponent) {
      // Add to loaded components
      system.loadedComponents.set(componentName, cachedComponent);
      return cachedComponent;
    }
    
    // Load the component from the registry
    const component = this.registry.getComponent(componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }
    
    // Add to loaded components
    system.loadedComponents.set(componentName, component);
    
    // Cache the component
    this.componentCache.set(component, component);
    
    return component;
  }
} 