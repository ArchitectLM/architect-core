/**
 * @file Component search implementation
 * @module @architectlm/rag
 */

import {
  Component,
  ComponentType,
  SearchOptions,
  SearchOptionsSchema,
  SearchResult,
  VectorDBConnector,
} from "../models.js";

/**
 * Component search for finding components in the vector database
 */
export class ComponentSearch {
  private vectorDB: VectorDBConnector;

  /**
   * Create a new component search
   */
  constructor(vectorDB: VectorDBConnector) {
    this.vectorDB = vectorDB;
  }

  /**
   * Search for components matching a query
   */
  async searchComponents(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const results = await this.vectorDB.search(query, options);

    // If options include a threshold, filter results by score
    if (options?.threshold) {
      return results.filter((result) => result.score >= options.threshold);
    }

    return results;
  }

  /**
   * Search for components of a specific type
   */
  async searchComponentsByType(
    query: string,
    type: ComponentType,
    options?: Omit<SearchOptions, "types">,
  ): Promise<SearchResult[]> {
    const searchOptions: SearchOptions = {
      ...options,
      types: [type],
    };

    return this.searchComponents(query, searchOptions);
  }

  /**
   * Get a component by ID
   */
  async getComponentById(id: string): Promise<Component | null> {
    return this.vectorDB.getDocument(id);
  }

  /**
   * Find components similar to a given component
   */
  async findSimilarComponents(
    component: Component,
    options?: Omit<SearchOptions, "types">,
  ): Promise<SearchResult[]> {
    // Create a search query from the component content and name
    const query = `${component.name} ${component.metadata.description || ""} ${component.content.substring(0, 200)}`;

    // Search for components of the same type
    const searchOptions: SearchOptions = {
      ...options,
      types: [component.type],
    };

    const results = await this.searchComponents(query, searchOptions);

    // Filter out the original component if it's in the results
    return results.filter((result) => result.component.id !== component.id);
  }

  /**
   * Search for components by name
   */
  async searchComponentsByName(
    name: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    // Create a search query focused on the name
    const query = `name:${name}`;

    return this.searchComponents(query, options);
  }

  /**
   * Search for components by path
   */
  async searchComponentsByPath(
    path: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    // Create a search query focused on the path
    const query = `path:${path}`;

    return this.searchComponents(query, options);
  }

  /**
   * Search for components by tags
   */
  async searchComponentsByTags(
    tags: string[],
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    // Create a search query focused on the tags
    const query = `tags:${tags.join(" ")}`;

    return this.searchComponents(query, options);
  }

  /**
   * Get all components of a specific type
   */
  async getAllComponentsByType(type: ComponentType): Promise<Component[]> {
    // Use a wildcard query to get all components of a type
    const results = await this.searchComponentsByType("*", type, {
      limit: 100,
    });

    return results.map((result) => result.component);
  }
}
