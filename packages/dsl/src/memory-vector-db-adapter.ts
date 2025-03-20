import { 
  VectorDBAdapter, 
  Component, 
  ComponentImplementation, 
  ComponentSearchCriteria 
} from './types.js';

/**
 * Configuration options for the memory vector database adapter
 */
export interface MemoryVectorDBAdapterOptions {
  /**
   * Name of the in-memory database
   */
  name: string;

  /**
   * Initial components to populate the database with
   */
  initialComponents?: Component[];

  /**
   * Initial implementations to populate the database with
   */
  initialImplementations?: ComponentImplementation[];
}

/**
 * In-memory implementation of the VectorDBAdapter interface for testing
 */
export class MemoryVectorDBAdapter implements VectorDBAdapter {
  private components: Map<string, Component> = new Map();
  private implementations: Map<string, ComponentImplementation> = new Map();
  private relationships: Map<string, Array<{ to: string, type: string, description?: string }>> = new Map();
  
  /**
   * Constructor
   * @param options Configuration options
   */
  constructor(private options: MemoryVectorDBAdapterOptions) {
    // Initialize with any provided components
    if (options.initialComponents) {
      for (const component of options.initialComponents) {
        this.components.set(`component-${component.name}`, { ...component });
      }
    }

    // Initialize with any provided implementations
    if (options.initialImplementations) {
      for (const implementation of options.initialImplementations) {
        this.implementations.set(
          `implementation-${implementation.componentName}`, 
          { ...implementation }
        );
      }
    }
  }

  /**
   * Store a component in the vector database
   * @param component The component to store
   * @returns The ID of the stored component
   */
  async storeComponent(component: Component): Promise<string> {
    const id = `component-${component.name}`;
    this.components.set(id, { ...component });
    return id;
  }

  /**
   * Store a component implementation in the vector database
   * @param implementation The implementation to store
   * @returns The ID of the stored implementation
   */
  async storeImplementation(implementation: ComponentImplementation): Promise<string> {
    const id = `implementation-${implementation.componentName}`;
    this.implementations.set(id, { ...implementation });
    return id;
  }

  /**
   * Store a relationship between components
   * @param from The ID of the source component
   * @param to The ID of the target component
   * @param type The type of relationship
   * @param description Optional description of the relationship
   */
  async storeRelationship(from: string, to: string, type: string, description?: string): Promise<void> {
    if (!this.relationships.has(from)) {
      this.relationships.set(from, []);
    }
    this.relationships.get(from)!.push({ to, type, description });
  }

  /**
   * Search for components
   * @param query The search query
   * @param filters Optional filters to apply
   * @returns Array of matching components
   */
  async searchComponents(query: string, filters?: Partial<ComponentSearchCriteria>): Promise<Component[]> {
    let results = Array.from(this.components.values());
    
    // Simple text search
    if (query) {
      results = results.filter(component => 
        JSON.stringify(component).toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Apply filters
    if (filters) {
      if (filters.type) {
        results = results.filter(component => component.type === filters.type);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(component => 
          component.tags && filters.tags!.some(tag => component.tags!.includes(tag))
        );
      }
      
      if (filters.namePattern) {
        const pattern = filters.namePattern instanceof RegExp 
          ? filters.namePattern 
          : new RegExp(filters.namePattern);
        results = results.filter(component => pattern.test(component.name));
      }
      
      if (filters.author) {
        results = results.filter(component => 
          component.authors && component.authors.includes(filters.author!)
        );
      }
      
      if (filters.filter) {
        results = results.filter(filters.filter);
      }
    }
    
    return results;
  }

  /**
   * Get related components
   * @param componentName The name of the component to get related components for
   * @param relationshipType Optional relationship type to filter by
   * @returns Array of related components
   */
  async getRelatedComponents(componentName: string, relationshipType?: string): Promise<Component[]> {
    const componentId = `component-${componentName}`;
    const relations = this.relationships.get(componentId) || [];
    
    // Filter by relationship type if provided
    const filteredRelations = relationshipType 
      ? relations.filter(rel => rel.type === relationshipType)
      : relations;
    
    // Get the related components
    const relatedComponents: Component[] = [];
    for (const relation of filteredRelations) {
      const component = this.components.get(relation.to);
      if (component) {
        relatedComponents.push(component);
      }
    }
    
    return relatedComponents;
  }

  /**
   * Get all components in the database
   * @returns Array of all components
   */
  async getAllComponents(): Promise<Component[]> {
    return Array.from(this.components.values());
  }

  /**
   * Get all implementations in the database
   * @returns Array of all implementations
   */
  async getAllImplementations(): Promise<ComponentImplementation[]> {
    return Array.from(this.implementations.values());
  }

  /**
   * Clear all data from the database
   */
  async clear(): Promise<void> {
    this.components.clear();
    this.implementations.clear();
    this.relationships.clear();
  }
} 