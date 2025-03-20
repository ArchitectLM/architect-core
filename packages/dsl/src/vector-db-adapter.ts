import { Component, ComponentImplementation, ComponentSearchCriteria, VectorDBAdapter } from './types.js';
import { vectorDBAdapterFactory } from './vector-db-factory.js';
import { v4 as uuidv4 } from 'uuid';

// Import ChromaDB types without requiring the actual dependency
type ChromaClient = any;
type ChromaCollection = any;

/**
 * Configuration for the ChromaVectorDBAdapter
 */
export interface ChromaVectorDBAdapterConfig {
  /**
   * URL of the ChromaDB server
   */
  url: string;

  /**
   * Name of the collection to use
   */
  collectionName: string;

  /**
   * Maximum size of a chunk in characters
   * @default 8000
   */
  maxChunkSize?: number;

  /**
   * Overlap between chunks in characters
   * @default 200
   */
  chunkOverlap?: number;
}

/**
 * Implementation of the VectorDBAdapter interface using ChromaDB
 */
export class ChromaVectorDBAdapter implements VectorDBAdapter {
  private client: ChromaClient;
  private collection: ChromaCollection | null = null;
  private config: ChromaVectorDBAdapterConfig;

  /**
   * Constructor
   * @param config Configuration for the adapter
   */
  constructor(config: ChromaVectorDBAdapterConfig) {
    this.config = {
      maxChunkSize: 8000,
      chunkOverlap: 200,
      ...config
    };

    // Lazy-load ChromaDB to avoid requiring it as a direct dependency
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ChromaClient } = require('chromadb');
      this.client = new ChromaClient({ path: this.config.url });
    } catch (error) {
      throw new Error('ChromaDB is not installed. Please install it with: npm install chromadb');
    }
  }

  /**
   * Get the ChromaDB collection, creating it if it doesn't exist
   * @returns The ChromaDB collection
   */
  private async getCollection(): Promise<ChromaCollection> {
    if (!this.collection) {
      const collectionId = uuidv4();
      this.collection = await this.client.getOrCreateCollection({
        name: collectionId,
        metadata: {
          originalName: this.config.collectionName,
          type: 'component'
        }
      });
    }
    return this.collection;
  }

  /**
   * Store a component in the vector database
   * @param component The component to store
   * @returns The ID of the stored component
   */
  async storeComponent(component: Component): Promise<string> {
    const collection = await this.getCollection();
    const id = uuidv4();

    // Extract metadata for filtering
    const metadata = this.extractMetadata(component);

    // Convert component to string for embedding
    const componentStr = JSON.stringify(component);

    // Check if we need to chunk the component
    if (componentStr.length <= this.config.maxChunkSize!) {
      // Store as a single document
      await collection.add({
        ids: [id],
        metadatas: [metadata],
        documents: [componentStr]
      });
    } else {
      // Chunk the component
      const chunks = this.chunkText(componentStr);
      
      // Store each chunk with the same ID but different chunk numbers
      for (let i = 0; i < chunks.length; i++) {
        await collection.add({
          ids: [`${id}-chunk-${i}`],
          metadatas: [{
            ...metadata,
            chunkId: i,
            totalChunks: chunks.length,
            parentId: id,
            isChunk: true
          }],
          documents: [chunks[i]]
        });
      }

      // Store a metadata document with the component info but no content
      await collection.add({
        ids: [id],
        metadatas: [{
          ...metadata,
          hasChunks: true,
          chunkCount: chunks.length
        }],
        documents: [JSON.stringify({
          name: component.name,
          type: component.type,
          description: component.description
        })]
      });
    }

    return id;
  }

  /**
   * Store a component implementation in the vector database
   * @param implementation The implementation to store
   * @returns The ID of the stored implementation
   */
  async storeImplementation(implementation: ComponentImplementation): Promise<string> {
    const collection = await this.getCollection();
    const id = uuidv4();

    // Extract metadata
    const metadata = {
      type: 'implementation',
      componentName: implementation.componentName,
      complexity: implementation.metadata?.complexity,
      estimatedLatency: implementation.metadata?.estimatedLatency,
      sideEffects: implementation.metadata?.sideEffects?.join(','),
      testCaseCount: implementation.metadata?.testCases?.length
    };

    // Convert implementation to string
    // Note: We stringify the function to store its source code
    const implementationStr = JSON.stringify({
      componentName: implementation.componentName,
      implementation: implementation.implementation.toString(),
      metadata: implementation.metadata
    });

    // Check if we need to chunk the implementation
    if (implementationStr.length <= this.config.maxChunkSize!) {
      // Store as a single document
      await collection.add({
        ids: [id],
        metadatas: [metadata],
        documents: [implementationStr]
      });
    } else {
      // Chunk the implementation
      const chunks = this.chunkText(implementationStr);
      
      // Store each chunk
      for (let i = 0; i < chunks.length; i++) {
        await collection.add({
          ids: [`${id}-chunk-${i}`],
          metadatas: [{
            ...metadata,
            chunkId: i,
            totalChunks: chunks.length,
            parentId: id,
            isChunk: true
          }],
          documents: [chunks[i]]
        });
      }

      // Store a metadata document
      await collection.add({
        ids: [id],
        metadatas: [{
          ...metadata,
          hasChunks: true,
          chunkCount: chunks.length
        }],
        documents: [JSON.stringify({
          componentName: implementation.componentName,
          type: 'implementation'
        })]
      });
    }

    return id;
  }

  /**
   * Store a relationship between components
   * @param from Source component name
   * @param to Target component name
   * @param type Relationship type
   * @param description Optional description of the relationship
   */
  async storeRelationship(from: string, to: string, type: string, description?: string): Promise<void> {
    const collection = await this.getCollection();
    const id = uuidv4();

    // Store the relationship as a document
    await collection.add({
      ids: [id],
      metadatas: [{
        type: 'relationship',
        fromComponent: from,
        toComponent: to,
        relationshipType: type
      }],
      documents: [JSON.stringify({
        from,
        to,
        type,
        description: description || ''
      })]
    });
  }

  /**
   * Search for components
   * @param query Search query
   * @param filters Optional filters
   * @returns Array of matching components
   */
  async searchComponents(query: string, filters?: Partial<ComponentSearchCriteria>): Promise<Component[]> {
    const collection = await this.getCollection();

    // Convert filters to ChromaDB where clauses
    const whereClause: Record<string, any> = {};
    
    if (filters?.type) {
      whereClause.type = filters.type;
    }

    // Note: ChromaDB doesn't support array contains directly, so we'll filter tags after query
    
    // Perform the search
    const results = await collection.query({
      queryTexts: [query],
      nResults: 10,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined
    });

    // Process results
    const components: Component[] = [];
    
    if (results.documents && results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        try {
          const component = JSON.parse(results.documents[0][i]) as Component;
          
          // Skip non-components and chunks
          if (!component.type || results.metadatas?.[0]?.[i]?.isChunk) {
            continue;
          }
          
          // Apply tag filtering if needed
          if (filters?.tags && filters.tags.length > 0) {
            if (!component.tags || !filters.tags.some(tag => component.tags?.includes(tag))) {
              continue;
            }
          }
          
          components.push(component);
        } catch (error) {
          console.error('Error parsing component:', error);
        }
      }
    }

    return components;
  }

  /**
   * Get related components
   * @param componentName Name of the component
   * @param relationshipType Optional relationship type filter
   * @returns Array of related components
   */
  async getRelatedComponents(componentName: string, relationshipType?: string): Promise<Component[]> {
    const collection = await this.getCollection();

    // Find relationships where this component is the source
    const whereClause: Record<string, any> = {
      type: 'relationship',
      fromComponent: componentName
    };

    if (relationshipType) {
      whereClause.relationshipType = relationshipType;
    }

    // Query for relationships
    const relationshipResults = await collection.get({
      where: whereClause
    });

    // Extract target component names
    const targetComponentNames: string[] = [];
    
    if (relationshipResults.metadatas) {
      for (const metadata of relationshipResults.metadatas) {
        if (metadata.toComponent) {
          targetComponentNames.push(metadata.toComponent);
        }
      }
    }

    // If no related components, return empty array
    if (targetComponentNames.length === 0) {
      return [];
    }

    // Get the actual components
    const components: Component[] = [];
    
    for (const name of targetComponentNames) {
      const componentResults = await collection.get({
        where: {
          name
        }
      });

      if (componentResults.documents) {
        for (const doc of componentResults.documents) {
          try {
            const component = JSON.parse(doc) as Component;
            components.push(component);
          } catch (error) {
            console.error('Error parsing component:', error);
          }
        }
      }
    }

    return components;
  }

  /**
   * Extract metadata from a component for filtering
   * @param component The component
   * @returns Metadata object
   */
  private extractMetadata(component: Component): Record<string, any> {
    return {
      name: component.name,
      type: component.type,
      version: component.version || '',
      tags: component.tags?.join(',') || '',
      authors: component.authors?.join(',') || '',
      description: component.description?.substring(0, 1000) || ''
    };
  }

  /**
   * Chunk text into smaller pieces for storage
   * @param text Text to chunk
   * @returns Array of chunks
   */
  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    const maxSize = this.config.maxChunkSize!;
    const overlap = this.config.chunkOverlap!;
    
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + maxSize, text.length);
      chunks.push(text.substring(start, end));
      start = end - overlap;
      
      // If we're near the end, just include the rest
      if (start + maxSize >= text.length) {
        if (start < text.length) {
          chunks.push(text.substring(start));
        }
        break;
      }
    }
    
    return chunks;
  }
}

// Register the ChromaVectorDBAdapter with the factory
vectorDBAdapterFactory.registerAdapterType('chroma', ChromaVectorDBAdapter); 