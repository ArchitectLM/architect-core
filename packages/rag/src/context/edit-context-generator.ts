/**
 * @file Edit context generator implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType, EditContext } from "../models.js";
import { ComponentSearch } from "../search/component-search.js";

/**
 * Edit context generator for creating edit contexts based on queries
 */
export class EditContextGenerator {
  private componentSearch: ComponentSearch;

  /**
   * Create a new edit context generator
   */
  constructor(componentSearch: ComponentSearch) {
    this.componentSearch = componentSearch;
  }

  /**
   * Generate an edit context for a query
   */
  async generateContext(
    query: string,
    includeGlobalContext = false,
  ): Promise<EditContext> {
    // Search for relevant components
    const searchResults = await this.componentSearch.searchComponents(query, {
      limit: 10,
      threshold: 0.7,
    });

    const relevantComponents = searchResults.map((result) => result.component);

    // Generate suggested changes for each component
    const suggestedChanges = relevantComponents.map((component) => ({
      componentId: component.id!,
      originalContent: component.content,
      reason: `Relevant to query "${query}" with score ${
        searchResults
          .find((r) => r.component.id === component.id)
          ?.score.toFixed(2) || "unknown"
      }`,
    }));

    // Create the edit context
    const context: EditContext = {
      query,
      relevantComponents,
      suggestedChanges,
    };

    // Add global context if requested
    if (includeGlobalContext) {
      context.globalContext =
        await this.generateGlobalContext(relevantComponents);
    }

    return context;
  }

  /**
   * Generate an edit context for a query with specific component types
   */
  async generateContextByTypes(
    query: string,
    types: ComponentType[],
    includeGlobalContext = false,
  ): Promise<EditContext> {
    // Search for relevant components of the specified types
    const searchResults = await this.componentSearch.searchComponents(query, {
      limit: 10,
      threshold: 0.7,
      types,
    });

    const relevantComponents = searchResults.map((result) => result.component);

    // Generate suggested changes for each component
    const suggestedChanges = relevantComponents.map((component) => ({
      componentId: component.id!,
      originalContent: component.content,
      reason: `Relevant to query "${query}" with score ${
        searchResults
          .find((r) => r.component.id === component.id)
          ?.score.toFixed(2) || "unknown"
      }`,
    }));

    // Create the edit context
    const context: EditContext = {
      query,
      relevantComponents,
      suggestedChanges,
    };

    // Add global context if requested
    if (includeGlobalContext) {
      context.globalContext =
        await this.generateGlobalContext(relevantComponents);
    }

    return context;
  }

  /**
   * Generate an edit context for a specific component
   */
  async generateContextForComponent(
    componentId: string,
    query: string,
    includeGlobalContext = false,
  ): Promise<EditContext> {
    // Get the component
    const component = await this.componentSearch.getComponentById(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    // Find similar components
    const similarResults =
      await this.componentSearch.findSimilarComponents(component);
    const similarComponents = similarResults.map((result) => result.component);

    // Combine the component with similar components
    const relevantComponents = [component, ...similarComponents];

    // Generate suggested changes for each component
    const suggestedChanges = relevantComponents.map((comp) => ({
      componentId: comp.id!,
      originalContent: comp.content,
      reason:
        comp.id === componentId
          ? `Target component for query "${query}"`
          : `Similar to target component with score ${
              similarResults
                .find((r) => r.component.id === comp.id)
                ?.score.toFixed(2) || "unknown"
            }`,
    }));

    // Create the edit context
    const context: EditContext = {
      query,
      relevantComponents,
      suggestedChanges,
    };

    // Add global context if requested
    if (includeGlobalContext) {
      context.globalContext =
        await this.generateGlobalContext(relevantComponents);
    }

    return context;
  }

  /**
   * Generate global context information based on components
   * @private
   */
  private async generateGlobalContext(
    components: Component[],
  ): Promise<string> {
    // Extract component types
    const types = new Set(components.map((component) => component.type));

    // Get information about each type
    const typeInfo = await Promise.all(
      Array.from(types).map(async (type) => {
        const count = await this.getComponentCountByType(type);
        return `${type}: ${count} components`;
      }),
    );

    // Generate a summary of the components
    const componentSummary = components
      .map(
        (component) =>
          `- ${component.type} "${component.name}" (${component.metadata.path}): ${component.metadata.description || "No description"}`,
      )
      .join("\n");

    // Create the global context
    return `
System Overview:
This is a reactive system with the following component types:
${typeInfo.join("\n")}

Relevant Components:
${componentSummary}

Dependencies:
${this.extractDependencies(components)}
    `.trim();
  }

  /**
   * Get the number of components of a specific type
   * @private
   */
  private async getComponentCountByType(type: ComponentType): Promise<number> {
    const components = await this.componentSearch.getAllComponentsByType(type);
    return components.length;
  }

  /**
   * Extract dependencies from components
   * @private
   */
  private extractDependencies(components: Component[]): string {
    // Extract all dependencies
    const dependencies = new Set<string>();

    for (const component of components) {
      if (component.metadata.dependencies) {
        for (const dependency of component.metadata.dependencies) {
          dependencies.add(dependency);
        }
      }
    }

    // If no dependencies, return a message
    if (dependencies.size === 0) {
      return "No explicit dependencies found.";
    }

    // Return the dependencies as a list
    return Array.from(dependencies)
      .map((dep) => `- ${dep}`)
      .join("\n");
  }
}
