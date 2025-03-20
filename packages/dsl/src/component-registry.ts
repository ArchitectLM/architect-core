import { Component, ComponentSearchCriteria } from './types.js';

/**
 * Registry for storing and retrieving components
 */
export class ComponentRegistry {
  private components: Map<string, Component> = new Map();

  /**
   * Register a component in the registry
   * @param component The component to register
   * @throws Error if a component with the same name already exists
   */
  register(component: Component): void {
    if (this.components.has(component.name)) {
      throw new Error(`Component with name ${component.name} already exists`);
    }
    this.components.set(component.name, component);
  }

  /**
   * Get a component by name
   * @param name The name of the component
   * @returns The component or undefined if not found
   */
  getComponent(name: string): Component | undefined {
    return this.components.get(name);
  }

  /**
   * Find components matching the given criteria
   * @param criteria The search criteria
   * @returns Array of matching components
   */
  findComponents(criteria: Partial<ComponentSearchCriteria>): Component[] {
    const result: Component[] = [];

    for (const component of this.components.values()) {
      if (this.matchesCriteria(component, criteria)) {
        result.push(component);
      }
    }

    return result;
  }

  /**
   * Check if a component matches the given criteria
   * @param component The component to check
   * @param criteria The search criteria
   * @returns True if the component matches the criteria
   */
  private matchesCriteria(component: Component, criteria: Partial<ComponentSearchCriteria>): boolean {
    // Check type
    if (criteria.type !== undefined && component.type !== criteria.type) {
      return false;
    }

    // Check tags
    if (criteria.tags !== undefined && criteria.tags.length > 0) {
      if (!component.tags || !criteria.tags.some(tag => component.tags?.includes(tag))) {
        return false;
      }
    }

    // Check name pattern
    if (criteria.namePattern !== undefined) {
      if (typeof criteria.namePattern === 'string') {
        if (!component.name.includes(criteria.namePattern)) {
          return false;
        }
      } else if (criteria.namePattern instanceof RegExp) {
        if (!criteria.namePattern.test(component.name)) {
          return false;
        }
      }
    }

    // Check author
    if (criteria.author !== undefined) {
      if (!component.authors || !component.authors.includes(criteria.author)) {
        return false;
      }
    }

    // Check version
    if (criteria.version !== undefined && component.version !== criteria.version) {
      return false;
    }

    // Apply custom filter if provided
    if (criteria.filter !== undefined && !criteria.filter(component)) {
      return false;
    }

    return true;
  }

  /**
   * Serialize the registry to JSON
   * @returns Serialized registry
   */
  serialize(): string {
    const components = Array.from(this.components.values());
    return JSON.stringify(components);
  }

  /**
   * Deserialize a registry from JSON
   * @param serialized Serialized registry
   * @returns New ComponentRegistry instance
   */
  static deserialize(serialized: string): ComponentRegistry {
    const registry = new ComponentRegistry();
    const components = JSON.parse(serialized) as Component[];
    
    for (const component of components) {
      registry.register(component);
    }
    
    return registry;
  }

  /**
   * Get all components in the registry
   * @returns Array of all components
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  /**
   * Check if a component exists in the registry
   * @param name The name of the component
   * @returns True if the component exists
   */
  hasComponent(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Remove a component from the registry
   * @param name The name of the component to remove
   * @returns True if the component was removed, false if it didn't exist
   */
  removeComponent(name: string): boolean {
    return this.components.delete(name);
  }

  /**
   * Clear all components from the registry
   */
  clear(): void {
    this.components.clear();
  }

  /**
   * Get the number of components in the registry
   * @returns The number of components
   */
  get size(): number {
    return this.components.size;
  }
} 