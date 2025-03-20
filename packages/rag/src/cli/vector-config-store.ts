/**
 * @file Vector Config Store implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType, VectorDBConnector } from "../models.js";

/**
 * Configuration version information
 */
export interface ConfigVersion {
  id: string;
  name: string;
  version: string;
  content: string;
  timestamp: number;
}

/**
 * Vector Config Store for persisting DSL configurations
 */
export class VectorConfigStore {
  private vectorDB: VectorDBConnector;

  /**
   * Create a new Vector Config Store
   */
  constructor(vectorDB: VectorDBConnector) {
    this.vectorDB = vectorDB;
  }

  /**
   * Save a configuration to the vector database
   */
  async saveConfiguration(
    configName: string,
    content: string,
    version: string,
  ): Promise<string> {
    // Create a component for the configuration
    const component: Component = {
      type: 'system', // Using system type for configurations
      name: configName,
      content,
      metadata: {
        path: `configs/${configName}.ts`,
        description: `${configName} configuration`,
        version,
        createdAt: Date.now(),
      },
    };

    // Add to vector database
    return this.vectorDB.addDocument(component);
  }

  /**
   * Update an existing configuration
   */
  async updateConfiguration(
    configName: string,
    content: string,
    version: string,
  ): Promise<boolean> {
    // Search for the configuration
    const results = await this.vectorDB.search(
      `name:${configName} version:${version}`,
      {
        limit: 1,
        threshold: 0.7,
        includeMetadata: true,
        includeEmbeddings: false,
        orderBy: 'relevance',
        orderDirection: 'desc'
      },
    );

    // If not found, return false
    if (results.length === 0) {
      return false;
    }

    // Get the component ID
    const id = results[0].component.id;

    if (!id) {
      return false;
    }

    // Update the component
    await this.vectorDB.updateDocument(id, {
      content,
      metadata: {
        path: results[0].component.metadata.path,
        updatedAt: Date.now(),
      },
    });

    return true;
  }

  /**
   * Simple diff implementation to avoid external dependencies
   */
  private simpleDiff(oldText: string, newText: string): string {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    let diffOutput = "";

    // Very simple line-by-line diff
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : "";
      const newLine = i < newLines.length ? newLines[i] : "";

      if (oldLine === newLine) {
        // Unchanged line
        diffOutput += ` ${oldLine}\n`;
      } else {
        // Changed line
        if (oldLine) {
          diffOutput += `- ${oldLine}\n`;
        }
        if (newLine) {
          diffOutput += `+ ${newLine}\n`;
        }
      }
    }

    return diffOutput;
  }

  /**
   * Get a configuration from the vector database
   */
  async getConfiguration(
    configName: string,
    version: string,
  ): Promise<string | null> {
    // Search for the configuration
    const results = await this.vectorDB.search(
      `name:${configName}Config version:${version}`,
      {
        limit: 1,
        threshold: 0.7,
        includeMetadata: true,
        includeEmbeddings: false,
        orderBy: 'relevance',
        orderDirection: 'desc'
      },
    );

    // Return the content if found
    if (results.length > 0) {
      return results[0].component.content;
    }

    return null;
  }

  /**
   * Get all versions of a configuration
   */
  async getAllVersions(configName: string): Promise<ConfigVersion[]> {
    // Search for all versions of the configuration
    const results = await this.vectorDB.search(`name:${configName}Config`, {
      limit: 100, // Assuming there won't be more than 100 versions
      threshold: 0.7,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    // Convert to ConfigVersion objects
    const versions = results.map((result) => {
      const component = result.component;
      return {
        id: component.id || "",
        name: configName,
        version: component.metadata.version || "unknown",
        content: component.content,
        timestamp: component.metadata.createdAt || 0,
      };
    });

    // Sort by version (assuming semantic versioning)
    return versions.sort((a, b) => {
      // Extract version numbers
      const aVersion = a.version.replace(/[^\d.]/g, "");
      const bVersion = b.version.replace(/[^\d.]/g, "");

      // Split into parts
      const aParts = aVersion.split(".").map(Number);
      const bParts = bVersion.split(".").map(Number);

      // Compare each part
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;

        if (aPart !== bPart) {
          return aPart - bPart;
        }
      }

      return 0;
    });
  }

  /**
   * Compare two versions of a configuration
   */
  async compareVersions(
    configName: string,
    version1: string,
    version2: string,
  ): Promise<string> {
    // First, search for the specific versions to get their IDs
    const results = await this.vectorDB.search(`name:${configName}`, {
      limit: 100,
      threshold: 0.7,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    // Find the IDs for the specific versions
    let id1 = "";
    let id2 = "";

    for (const result of results) {
      const component = result.component;
      const version = component.metadata.version || "unknown";

      if (version === version1) {
        id1 = component.id || "";
      } else if (version === version2) {
        id2 = component.id || "";
      }
    }

    // If either ID is not found, return an error message
    if (!id1 || !id2) {
      return `Could not find one or both versions: ${version1}, ${version2}`;
    }

    // Get the components using getDocument
    const component1 = await this.vectorDB.getDocument(id1);
    const component2 = await this.vectorDB.getDocument(id2);

    // If either component is not found, return an error message
    if (!component1 || !component2) {
      return `Could not retrieve one or both versions: ${version1}, ${version2}`;
    }

    // Generate simple diff
    return this.simpleDiff(component1.content, component2.content);
  }
}