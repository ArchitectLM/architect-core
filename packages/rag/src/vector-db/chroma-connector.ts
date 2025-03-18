/**
 * @file ChromaDB connector implementation
 * @module @architectlm/rag
 */

import { VectorDBConnector } from './base-connector.js';
import { ChromaClient, Collection, Embeddings, IEmbeddingFunction } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  Component,
  SearchOptions as SearchOptionsType,
  SearchResult as SearchResultType,
  FeedbackRecord as FeedbackRecordType,
  RetrievalRecord as RetrievalRecordType,
  ComponentVersion as ComponentVersionType,
  LearningTask as LearningTaskType,
  TaskDifficulty,
  FeedbackType,
  VectorDBConfig,
  VectorDBConfigSchema,
  ExemplarSolution,
} from '../models.js';
import { convertCodeToAst, convertAstToCode, extractAstFeatures } from '../utils/ast-converter.js';
import { SimpleEmbeddingFunction } from './simple-embedding.js';
import { tagUtils } from '../utils/tag-utils.js';
import { logger } from '../utils/logger.js';
import { ComponentCache } from '../cache/component-cache.js';
import { ComponentType as DslComponentType } from '@architectlm/dsl';

type Metadata = Record<string, string | number | boolean>;

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000
};

// Define schemas for validation
const SearchOptionsSchema = z.object({
  limit: z.number().default(5),
  threshold: z.number().default(0.8),
  tags: z.array(z.string()).optional(),
  types: z.array(z.enum(['schema', 'command', 'query', 'event', 'workflow', 'extension', 'plugin'] as const)).optional()
});

// Rename interfaces to avoid conflicts with imported types
interface SearchOptions {
  limit: number;
  threshold: number;
  tags?: string[];
  types?: ComponentType[];
}

interface SearchResult {
  component: Component;
  score: number;
  distance: number;
}

interface FeedbackRecord extends FeedbackRecordType {
  id?: string;
}

interface RetrievalRecord extends RetrievalRecordType {
  id?: string;
}

interface ComponentVersion extends ComponentVersionType {
  id?: string;
}

interface LearningTask extends LearningTaskType {
  id?: string;
}

interface TaskSolution {
  content: string;
  createdAt: number;
  author: string;
  taskId: string;
  explanation: string;
  quality: number;
  id?: string;
}

interface RetrievalOutcome {
  timestamp: number;
  successful: boolean;
  usedComponentIds: string[];
  feedback?: string;
}

interface ChromaCollection {
  name: string;
  metadata?: {
    originalName?: string;
    [key: string]: any;
  };
}

type ComponentType = 'schema' | 'command' | 'query' | 'event' | 'workflow' | 'extension' | 'plugin';

/**
 * Custom embedding function that implements Chroma's IEmbeddingFunction interface
 */
class ComponentEmbeddingFunction implements IEmbeddingFunction {
  private dimension: number;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateSingle(text)));
  }

  private async generateSingle(text: string): Promise<number[]> {
    try {
      const embedding = new Array(this.dimension).fill(0);
      
      // Convert text to lowercase and split into words
      const words = text.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);
      
      // Create word frequency map
      const wordFreq = new Map<string, number>();
      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
      
      // Calculate TF-IDF like features
      const maxFreq = Math.max(...Array.from(wordFreq.values()));
      Array.from(wordFreq.entries()).forEach(([word, freq], i) => {
        const tf = freq / maxFreq;
        const position = Math.min(i, this.dimension - 1);
        embedding[position] = tf;
      });
      
      // Add special weighting for component type and name if present
      const typeMatch = text.match(/type:\s*['"]?(\w+)['"]?/i);
      const nameMatch = text.match(/name:\s*['"]?(\w+)['"]?/i);
      
      if (typeMatch) {
        const typePos = Math.abs(this.hashString(typeMatch[1]) % (this.dimension / 4));
        embedding[typePos] += 1.5; // Boost type signal
      }
      
      if (nameMatch) {
        const namePos = Math.abs(this.hashString(nameMatch[1]) % (this.dimension / 4)) + (this.dimension / 4);
        embedding[namePos] += 1.5; // Boost name signal
      }
      
      // Add n-gram features
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = words[i] + ' ' + words[i + 1];
        const pos = Math.abs(this.hashString(bigram) % (this.dimension / 2)) + (this.dimension / 2);
        embedding[pos] += 0.5; // Lower weight for bigrams
      }
      
      // Normalize the vector to unit length
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < this.dimension; i++) {
          embedding[i] /= magnitude;
        }
      }
      
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Fallback to random embedding with proper normalization
      const randomEmbedding = Array(this.dimension).fill(0).map(() => Math.random() * 2 - 1);
      const magnitude = Math.sqrt(randomEmbedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < this.dimension; i++) {
          randomEmbedding[i] /= magnitude;
        }
      }
      return randomEmbedding;
    }
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash >>> 0;
  }
}

type WhereDocument = {
  $and?: Record<string, any>[];
  $or?: Record<string, any>[];
};

/**
 * ChromaDB connector implementation
 */
export class ChromaDBConnector implements VectorDBConnector {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private feedbackCollection: Collection | null = null;
  private retrievalCollection: Collection | null = null;
  private versionCollection: Collection | null = null;
  private learningCollection: Collection | null = null;
  private config: VectorDBConfig;
  private retryConfig: RetryConfig;
  private initialized: boolean = false;
  private embeddingFunction: IEmbeddingFunction;
  private collectionIds: {
    main: string;
    feedback: string;
    retrieval: string;
    version: string;
    learning: string;
  } | null = null;
  private cache: ComponentCache;

  /**
   * Create a new ChromaDB connector
   */
  constructor(config: VectorDBConfig & { url?: string }, retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = VectorDBConfigSchema.parse(config);
    this.retryConfig = retryConfig;
    this.cache = new ComponentCache();
    this.embeddingFunction = new SimpleEmbeddingFunction(this.config.embeddingDimension);
    this.client = new ChromaClient({
      path: config.url || 'http://localhost:8000'
    });
  }

  private async getOrCreateCollectionIds(): Promise<{
    main: string;
    feedback: string;
    retrieval: string;
    version: string;
    learning: string;
  }> {
    if (this.collectionIds) {
      return this.collectionIds;
    }

    // Try to find existing collections by metadata
    const collections = (await this.client.listCollections()) as unknown as ChromaCollection[];
    const mainCollection = collections.find(c => c.metadata?.originalName === this.config.collectionName);
    const feedbackCollection = collections.find(c => c.metadata?.originalName === `${this.config.collectionName}-feedback`);
    const retrievalCollection = collections.find(c => c.metadata?.originalName === `${this.config.collectionName}-retrieval`);
    const versionCollection = collections.find(c => c.metadata?.originalName === `${this.config.collectionName}-version`);
    const learningCollection = collections.find(c => c.metadata?.originalName === `${this.config.collectionName}-learning`);

    this.collectionIds = {
      main: mainCollection?.name || uuidv4(),
      feedback: feedbackCollection?.name || uuidv4(),
      retrieval: retrievalCollection?.name || uuidv4(),
      version: versionCollection?.name || uuidv4(),
      learning: learningCollection?.name || uuidv4()
    };

    return this.collectionIds;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.embeddingFunction.generate([text]);
    return embeddings[0];
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.embeddingFunction.generate(texts);
  }

  private serializeMetadata(component: Component): Metadata {
    const metadata: Metadata = {
      type: component.type,
      name: component.name,
    };

    if (component.metadata.path) {
      metadata.path = component.metadata.path;
    }
    if (component.metadata.description) {
      metadata.description = component.metadata.description;
    }
    if (component.metadata.tags) {
      // Store tags as a comma-separated string
      metadata.tags = Array.isArray(component.metadata.tags) 
        ? component.metadata.tags.join(',')
        : component.metadata.tags;
    }
    if (component.metadata.createdAt) {
      metadata.createdAt = component.metadata.createdAt.toString();
    }
    if (component.metadata.author) {
      metadata.author = component.metadata.author;
    }
    if (component.metadata.version) {
      metadata.version = component.metadata.version;
    }
    if (component.id) {
      metadata.id = component.id;
    }

    return metadata;
  }

  private deserializeMetadata(metadata: Metadata | null): Component | null {
    if (!metadata) {
      return null;
    }

    const component: Component = {
      type: metadata.type as ComponentType,
      name: metadata.name as string,
      content: '', // Content will be populated from the documents field
      metadata: {
        path: metadata.path as string,
        description: metadata.description as string | undefined,
        // Split comma-separated tags into array
        tags: metadata.tags ? (metadata.tags as string).split(',') : [],
        createdAt: metadata.createdAt ? parseInt(metadata.createdAt as string) : undefined,
        author: metadata.author as string | undefined,
        version: metadata.version as string | undefined,
      }
    };

    if (metadata.id) {
      component.id = metadata.id as string;
    }

    return component;
  }

  private deserializeFeedbackMetadata(metadata: Metadata | null): FeedbackRecord | null {
    if (!metadata) {
      return null;
    }
    return {
      message: metadata.message as string,
      type: metadata.type as FeedbackType,
      componentId: metadata.componentId as string,
      timestamp: metadata.timestamp as number,
      userId: metadata.userId as string | undefined,
      metrics: metadata.metrics ? (metadata.metrics as unknown as Record<string, number>) : undefined,
    };
  }

  private deserializeRetrievalMetadata(metadata: Metadata | null): RetrievalRecord {
    if (!metadata) {
      throw new Error('Invalid metadata: null');
    }
    
    return {
      id: metadata.id as string,
      query: metadata.query as string,
      timestamp: metadata.timestamp as number,
      userId: metadata.userId as string,
      sessionId: metadata.sessionId as string,
      retrievedComponentIds: metadata.retrievedComponentIds ? JSON.parse(metadata.retrievedComponentIds as string) : [],
      outcome: metadata.outcome ? {
        timestamp: Date.now(),
        successful: (metadata.outcome as any)?.successful || false,
        usedComponentIds: (metadata.outcome as any)?.usedComponentIds || [],
        feedback: (metadata.outcome as any)?.feedback
      } : undefined
    };
  }

  private deserializeVersionMetadata(metadata: Metadata | null): ComponentVersion | null {
    if (!metadata) {
      return null;
    }
    return {
      content: metadata.content as string,
      author: metadata.author as string,
      componentId: metadata.componentId as string,
      timestamp: metadata.timestamp as number,
      versionNumber: metadata.versionNumber as number,
      changeDescription: metadata.changeDescription as string,
      id: metadata.id as string | undefined,
      previousContent: metadata.previousContent as string | undefined,
    };
  }

  private deserializeTaskMetadata(metadata: Metadata | null): LearningTask | null {
    if (!metadata) {
      return null;
    }
    return {
      description: metadata.description as string,
      createdAt: metadata.createdAt as number,
      title: metadata.title as string,
      difficulty: metadata.difficulty as TaskDifficulty,
      id: metadata.id as string | undefined,
      tags: metadata.tags ? (metadata.tags as unknown as string[]) : undefined,
      prerequisites: metadata.prerequisites ? (metadata.prerequisites as unknown as string[]) : undefined,
      relatedComponentIds: metadata.relatedComponentIds ? (metadata.relatedComponentIds as unknown as string[]) : undefined,
      order: metadata.order as number | undefined,
    };
  }

  private deserializeSolutionMetadata(metadata: Metadata | null): TaskSolution {
    if (!metadata) {
      throw new Error('Metadata cannot be null');
    }
    return {
      content: metadata.content as string,
      createdAt: metadata.createdAt as number,
      author: metadata.author as string,
      taskId: metadata.taskId as string,
      explanation: metadata.explanation as string,
      quality: metadata.quality as number,
      id: metadata.id as string | undefined,
    };
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Attempt ${attempt}/${this.retryConfig.maxRetries} failed for ${context}:`,
          error
        );

        if (attempt < this.retryConfig.maxRetries) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, this.retryConfig.maxDelay);
        }
      }
    }

    throw new Error(
      `Operation '${context}' failed after ${this.retryConfig.maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Initialize the ChromaDB connector
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const collectionIds = await this.getOrCreateCollectionIds();

      // Create or get the main collection
      this.collection = await this.client.getOrCreateCollection({
        name: collectionIds.main,
        metadata: {
          type: this.config.collectionName,
          originalName: this.config.collectionName,
          embeddingDimension: this.config.embeddingDimension
        }
      });

      // Create or get the feedback collection
      this.feedbackCollection = await this.client.getOrCreateCollection({
        name: collectionIds.feedback,
        metadata: {
          type: 'feedback',
          originalName: `${this.config.collectionName}-feedback`,
          embeddingDimension: this.config.embeddingDimension
        }
      });

      // Create or get the retrieval collection
      this.retrievalCollection = await this.client.getOrCreateCollection({
        name: collectionIds.retrieval,
        metadata: {
          type: 'retrieval',
          originalName: `${this.config.collectionName}-retrieval`,
          embeddingDimension: this.config.embeddingDimension
        }
      });

      // Create or get the version collection
      this.versionCollection = await this.client.getOrCreateCollection({
        name: collectionIds.version,
        metadata: {
          type: 'version',
          originalName: `${this.config.collectionName}-version`,
          embeddingDimension: this.config.embeddingDimension
        }
      });

      // Create or get the learning collection
      this.learningCollection = await this.client.getOrCreateCollection({
        name: collectionIds.learning,
        metadata: {
          type: 'learning',
          originalName: `${this.config.collectionName}-learning`,
          embeddingDimension: this.config.embeddingDimension
        }
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  /**
   * Add a document to the vector database with retry logic
   */
  async addDocument(document: Component): Promise<string> {
    return this.retry(async () => {
      if (!this.collection) {
        throw new Error("Collection not initialized");
      }

      const id = document.id || uuidv4();
      const documentWithId = { ...document, id };

      // Convert code to AST if not already present
      if (!documentWithId.ast && documentWithId.type === 'plugin') {
        try {
          documentWithId.ast = convertCodeToAst(documentWithId.content);
        } catch (error) {
          console.warn('Failed to convert code to AST:', error);
        }
      }

      // Log document details
      console.log(`Adding document: ${id}`);
      console.log(`Document type: ${documentWithId.type}`);
      console.log(`Document name: ${documentWithId.name}`);
      console.log(`Document content length: ${documentWithId.content.length}`);

      try {
        // Prepare metadata - ensure no null values and convert objects to strings
        const metadata = this.serializeMetadata(documentWithId);
        
        // Log original metadata before cleaning
        console.log('Original metadata before cleaning:', JSON.stringify(metadata, null, 2));
        
        // Clean up metadata to ensure it's ChromaDB compatible
        const cleanMetadata: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(metadata)) {
          if (value === null || value === undefined) {
            console.log(`Skipping null/undefined metadata field: ${key}`);
            continue;
          }
          
          // Convert complex objects to strings
          if (typeof value === 'object') {
            try {
              cleanMetadata[key] = JSON.stringify(value);
              console.log(`Converted object metadata field to string: ${key}`);
            } catch (e) {
              console.warn(`Failed to serialize metadata field ${key}:`, e);
              continue;
            }
          } else {
            cleanMetadata[key] = value;
            console.log(`Kept primitive metadata field: ${key} = ${value}`);
          }
        }

        // Log final cleaned metadata
        console.log('Final cleaned metadata:', JSON.stringify(cleanMetadata, null, 2));

        // Ensure content is not too large
        const maxContentLength = 1000000; // 1MB limit
        let content = documentWithId.content;
        if (content.length > maxContentLength) {
          console.warn(`Content too large (${content.length} bytes), truncating to ${maxContentLength} bytes`);
          content = content.substring(0, maxContentLength);
        }

        // Generate embedding using our custom function
        const embedding = await this.generateEmbedding(content);

        // Log the exact data being sent to ChromaDB
        console.log('Data being sent to ChromaDB:');
        console.log('ID:', id);
        console.log('Metadata:', JSON.stringify(cleanMetadata, null, 2));
        console.log('Content length:', content.length);
        console.log('Content preview:', content.substring(0, 100) + '...');
        console.log('Embedding length:', embedding.length);
        console.log('Embedding preview:', embedding.slice(0, 5));

        // Add document to collection with the generated embedding
        await this.collection.add({
          ids: [id],
          metadatas: [cleanMetadata],
          documents: [content],
          embeddings: [embedding]
        });

        console.log(`Successfully added document: ${id}`);
        return id;
      } catch (error) {
        console.error(`Error adding document ${id}:`, error);
        console.error(`Document details:`, {
          type: documentWithId.type,
          name: documentWithId.name,
          contentLength: documentWithId.content.length,
          metadata: documentWithId.metadata
        });
        throw error;
      }
    }, `addDocument(${document.name})`);
  }

  /**
   * Add multiple documents to the vector database
   */
  async addDocuments(documents: Component[]): Promise<string[]> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const ids = documents.map(doc => doc.id || uuidv4());
    const documentsWithIds = documents.map((doc, index) => ({
      ...doc,
      id: ids[index]
    }));

    // Process ASTs and prepare embedding texts
    const embedTexts = await Promise.all(documentsWithIds.map(async doc => {
      if (!doc.ast && doc.type === 'plugin') {
        try {
          doc.ast = convertCodeToAst(doc.content);
        } catch (error) {
          console.warn('Failed to convert code to AST:', error);
        }
      }

      let embedText = doc.content;
      if (doc.ast) {
        const astFeatures = extractAstFeatures(doc.ast);
        embedText = `${embedText}\n${astFeatures.join(' ')}`;
      }

      return embedText;
    }));

    // Generate embeddings
    const embeddings = await Promise.all(embedTexts.map(text => this.generateEmbedding(text)));

    // Prepare metadata
    const metadatas = documentsWithIds.map(doc => this.serializeMetadata(doc));

    // Add documents to collection
    await this.collection.add({
      ids,
      metadatas,
      documents: embedTexts,
      embeddings
    });

    console.log(`Added ${documents.length} documents to collection`);
    return ids;
  }

  /**
   * Search for similar documents in the vector database
   */
  async search(
    query: string,
    options?: {
      limit: number;
      threshold: number;
      includeMetadata: boolean;
      includeEmbeddings: boolean;
      orderBy: 'createdAt' | 'updatedAt' | 'relevance';
      orderDirection: 'asc' | 'desc';
      tags?: string[];
      types?: ComponentType[];
    }
  ): Promise<{ component: Component; score: number; distance?: number }[]> {
    const searchAttempts = [
      { threshold: 0.1, limit: 20 },
      { threshold: -0.2, limit: 40 },
      { threshold: -1, limit: 100 }
    ];

    for (const attempt of searchAttempts) {
      const results = await this._performSearch(query, {
        ...options,
        ...attempt
      });

      if (results.length > 0) {
        return results;
      }
    }

    return [];
  }

  private async _performSearch(query: string, options: SearchOptions): Promise<{ component: Component; score: number; distance?: number }[]> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // Try cache first for empty queries
    if (!query.trim() && options.types?.length === 1) {
      const cachedResults = this.cache.getByType(options.types[0])
        .map((component: Component) => ({
          component,
          score: 1,
          distance: 0
        }));

      if (cachedResults.length > 0) {
        logger.debug('Returning cached results', { count: cachedResults.length });
        return cachedResults;
      }
    }

    // For empty queries, use a default query that will return all documents
    const defaultQuery = "return all documents";
    const searchQuery = query.trim() ? query : defaultQuery;

    // Build where clause and ensure it's not undefined
    const where = this._buildWhereClause(options) || {};

    try {
      // Try to generate embeddings
      const embedding = await this.embeddingFunction.generate([searchQuery]);
      
      // Perform search with embeddings
      const results = await this.collection.query({
        queryEmbeddings: embedding,
        where,
        nResults: options.limit
      });

      return this._processSearchResults(results, options);
    } catch (error) {
      // If embedding generation fails, fall back to using queryTexts
      console.warn('Failed to generate embeddings, falling back to text search:', error);
      
      // Perform search with text
      const results = await this.collection.query({
        queryTexts: [searchQuery],
        where,
        nResults: options.limit
      });

      return this._processSearchResults(results, options);
    }
  }

  private _buildWhereClause(options?: SearchOptions): WhereDocument {
    // Always include two base filters to satisfy ChromaDB's requirement
    const baseFilters = [
      { type: { $ne: 'placeholder' } },
      { id: { $ne: 'placeholder' } }
    ];

    if (!options?.types || options.types.length === 0) {
      return { $and: baseFilters };
    }

    return {
      $and: [
        ...baseFilters,
        { type: { $in: options.types } }
      ]
    };
  }

  private _processSearchResults(results: any, options?: SearchOptions): { component: Component; score: number; distance?: number }[] {
    if (!results?.documents || !results?.metadatas || !results?.distances) {
      return [];
    }

    return results.documents[0]
      .map((doc: string, index: number) => {
        const metadata = results.metadatas[0][index];
        const distance = results.distances[0][index];
        const component = this.deserializeMetadata(metadata);

        if (!component) return null;

        // Set content and cache the component
        component.content = doc;
        if (component.id) {
          this.cache.add(component);
        }

        // Filter by tags if specified
        if (options?.tags?.length) {
          const componentTags = typeof component.metadata.tags === 'string' 
            ? component.metadata.tags.split(',').map(t => t.trim())
            : Array.isArray(component.metadata.tags) 
              ? component.metadata.tags 
              : [];
          const hasAllTags = options.tags.every(tag => 
            componentTags.some(t => t.toLowerCase() === tag.toLowerCase())
          );
          if (!hasAllTags) {
            return null;
          }
        }

        return {
          component,
          score: 1 - (distance / Math.max(...results.distances[0])),
          distance
        };
      })
      .filter(Boolean);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<Component | null> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const result = await this.collection.get({
      ids: [id],
    });

    if (!result.metadatas || result.metadatas.length === 0 || !result.documents) {
      return null;
    }

    const metadata = result.metadatas[0] as Metadata;
    const content = result.documents[0] as string;
    
    const component = this.deserializeMetadata(metadata);
    if (!component) {
      return null;
    }

    // Add the content to the component
    component.content = content;
    
    return component;
  }

  /**
   * Update a document in the vector database with retry logic
   */
  async updateDocument(
    id: string,
    document: Partial<Component>,
  ): Promise<void> {
    await this.retry(async () => {
      if (!this.collection) {
        throw new Error("Collection not initialized");
      }

      try {
        const existingDocument = await this.getDocument(id);

        if (!existingDocument) {
          throw new Error(`Document with ID ${id} not found`);
        }

        const updatedDocument = {
          ...existingDocument,
          ...document,
          metadata: {
            ...existingDocument.metadata,
            ...document.metadata,
            updatedAt: Date.now(),
          },
        };

        // First delete the existing document
        await this.collection.delete({
          ids: [id],
        });

        // Then add the updated document with the same ID
        await this.collection.add({
          ids: [id],
          metadatas: [this.serializeMetadata({ ...updatedDocument })],
          documents: [updatedDocument.content],
        });

        console.log(`Successfully updated document: ${id}`);
      } catch (error) {
        console.error(`Error updating document ${id}:`, error);
        throw error;
      }
    }, `updateDocument(${id})`);
  }

  /**
   * Delete a document from the vector database with retry logic
   */
  async deleteDocument(id: string): Promise<void> {
    await this.retry(async () => {
      if (!this.collection) {
        throw new Error("Collection not initialized");
      }

      try {
        await this.collection.delete({
          ids: [id],
        });
        console.log(`Successfully deleted document: ${id}`);
      } catch (error) {
        console.error(`Error deleting document ${id}:`, error);
        throw error;
      }
    }, `deleteDocument(${id})`);
  }

  /**
   * Delete all documents from the vector database
   */
  async deleteAllDocuments(): Promise<void> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    await this.collection.delete({
      where: {
        type: { $ne: "" }
      }
    });
  }

  private serializeFeedbackMetadata(feedback: FeedbackRecord): Metadata {
    return {
      type: 'feedback',
      name: `feedback-${feedback.componentId}`,
      content: feedback.message,
      message: feedback.message,
      componentId: feedback.componentId,
      feedbackType: feedback.type,
      timestamp: feedback.timestamp,
      userId: feedback.userId || '',
      metrics: feedback.metrics ? JSON.stringify(feedback.metrics) : '',
      id: feedback.id || '',
      metadata: JSON.stringify({
        path: `feedback/${feedback.componentId}`,
        createdAt: feedback.timestamp
      })
    };
  }

  private serializeRetrievalMetadata(retrieval: RetrievalRecord): Metadata {
    return {
      type: 'retrieval',
      name: `retrieval-${retrieval.id || ''}`,
      content: retrieval.query,
      query: retrieval.query,
      timestamp: retrieval.timestamp,
      userId: retrieval.userId || '',
      sessionId: retrieval.sessionId || '',
      retrievedComponentIds: JSON.stringify(retrieval.retrievedComponentIds),
      outcome: retrieval.outcome ? JSON.stringify(retrieval.outcome) : '',
      id: retrieval.id || '',
      metadata: JSON.stringify({
        path: `retrieval/${retrieval.id || ''}`,
        createdAt: retrieval.timestamp
      })
    };
  }

  private serializeVersionMetadata(version: ComponentVersion): Metadata {
    return {
      type: 'version',
      name: `version-${version.componentId}-${version.versionNumber}`,
      content: version.content,
      componentId: version.componentId,
      versionNumber: version.versionNumber,
      author: version.author,
      timestamp: version.timestamp,
      changeDescription: version.changeDescription,
      previousContent: version.previousContent || '',
      id: version.id || '',
      metadata: JSON.stringify({
        path: `version/${version.componentId}/${version.versionNumber}`,
        createdAt: version.timestamp,
        author: version.author
      })
    };
  }

  private serializeTaskMetadata(task: LearningTask): Metadata {
    return {
      type: 'plugin', // Using plugin as a placeholder type
      name: task.title,
      content: task.description,
      difficulty: task.difficulty,
      prerequisites: task.prerequisites ? JSON.stringify(task.prerequisites) : '',
      relatedComponentIds: task.relatedComponentIds ? JSON.stringify(task.relatedComponentIds) : '',
      order: task.order || 0,
      id: task.id || '',
      metadata: JSON.stringify({
        path: `task/${task.id || ''}`,
        description: task.description,
        tags: task.tags || [],
        createdAt: task.createdAt
      })
    };
  }

  /**
   * Add feedback for a component
   */
  async addFeedback(feedback: FeedbackRecord): Promise<string> {
    if (!this.feedbackCollection) {
      throw new Error("Feedback collection not initialized");
    }

    const id = feedback.id || uuidv4();
    const feedbackWithId = { ...feedback, id };

    await this.feedbackCollection.add({
      ids: [id],
      metadatas: [this.serializeFeedbackMetadata(feedbackWithId)],
      documents: [feedback.message],
    });

    return id;
  }

  /**
   * Get feedback for a component
   */
  async getFeedbackForComponent(componentId: string): Promise<FeedbackRecord[]> {
    if (!this.feedbackCollection) {
      throw new Error("Feedback collection not initialized");
    }

    const results = await this.feedbackCollection.query({
      queryTexts: [componentId],
      nResults: 100
    });

    if (!results?.metadatas?.[0]) {
      return [];
    }

    return results.metadatas[0]
      .map((metadata) => this.deserializeFeedbackMetadata(metadata as Metadata))
      .filter((record): record is FeedbackRecord => record !== null);
  }

  /**
   * Search for feedback
   */
  async searchFeedback(
    query: string,
    options?: SearchOptions,
  ): Promise<FeedbackRecord[]> {
    if (!this.feedbackCollection) {
      throw new Error("Feedback collection not initialized");
    }

    const parsedOptions = options
      ? SearchOptionsSchema.parse(options)
      : SearchOptionsSchema.parse({});

    const results = await this.feedbackCollection.query({
      queryTexts: [query],
      nResults: parsedOptions.limit,
    });

    if (!results?.metadatas?.[0]) {
      return [];
    }

    return results.metadatas[0]
      .map((metadata) => this.deserializeFeedbackMetadata(metadata as Metadata))
      .filter((record): record is FeedbackRecord => record !== null);
  }

  /**
   * Record a retrieval
   */
  async recordRetrieval(retrieval: RetrievalRecord): Promise<string> {
    if (!this.retrievalCollection) {
      throw new Error("Retrieval collection not initialized");
    }

    const id = retrieval.id || uuidv4();
    const retrievalWithId = { ...retrieval, id };

    await this.retrievalCollection.add({
      ids: [id],
      metadatas: [this.serializeRetrievalMetadata(retrievalWithId)],
      documents: [retrieval.query],
    });

    return id;
  }

  /**
   * Update a retrieval outcome
   */
  async updateRetrievalOutcome(
    retrievalId: string,
    outcome: RetrievalOutcome,
  ): Promise<void> {
    if (!this.retrievalCollection) {
      throw new Error("Retrieval collection not initialized");
    }

    const results = await this.retrievalCollection.get({
      ids: [retrievalId],
    });

    if (!results.metadatas || results.metadatas.length === 0) {
      throw new Error(`Retrieval with ID ${retrievalId} not found`);
    }

    const metadata = results.metadatas[0];
    if (!metadata) {
      throw new Error(`No metadata found for retrieval ${retrievalId}`);
    }

    const retrieval = this.deserializeRetrievalMetadata(metadata);
    if (!retrieval) {
      throw new Error(`Could not deserialize retrieval ${retrievalId}`);
    }

    const updatedRetrieval = {
      ...retrieval,
      outcome,
    };

    // First delete the existing retrieval
    await this.retrievalCollection.delete({
      ids: [retrievalId],
    });

    // Then add the updated retrieval with the same ID
    await this.retrievalCollection.add({
      ids: [retrievalId],
      metadatas: [this.serializeRetrievalMetadata({ ...updatedRetrieval })],
      documents: [retrieval.query],
    });
  }

  /**
   * Get retrievals by query
   */
  async getRetrievalsByQuery(query: string): Promise<RetrievalRecord[]> {
    if (!this.retrievalCollection) {
      throw new Error("Retrieval collection not initialized");
    }

    const results = await this.retrievalCollection.query({
      queryTexts: [query],
      nResults: 100
    });

    if (!results?.metadatas?.[0]) {
      return [];
    }

    return results.metadatas[0]
      .map((metadata) => this.deserializeRetrievalMetadata(metadata as Metadata))
      .filter((record): record is RetrievalRecord => record !== null);
  }

  /**
   * Get successful retrievals
   */
  async getSuccessfulRetrievals(query: string): Promise<RetrievalRecord[]> {
    const retrievals = await this.getRetrievalsByQuery(query);

    // Filter for successful retrievals
    const successfulRetrievals = retrievals.filter(
      (retrieval) => retrieval.outcome?.successful === true,
    );

    // Add similarity score for sorting
    const retrievalsWithSimilarity = successfulRetrievals.map((retrieval) => {
      // Simple similarity calculation based on word overlap
      const queryWords = new Set(query.toLowerCase().split(/\s+/));
      const retrievalWords = new Set(
        retrieval.query.toLowerCase().split(/\s+/),
      );

      // Calculate Jaccard similarity
      const intersection = new Set(
        [...queryWords].filter((word) => retrievalWords.has(word)),
      );
      const union = new Set([...queryWords, ...retrievalWords]);

      const similarity = intersection.size / union.size;

      return {
        ...retrieval,
        similarity,
      };
    });

    // Sort by similarity
    return retrievalsWithSimilarity
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, 10); // Return top 10
  }

  /**
   * Create a component version
   */
  async createComponentVersion(version: ComponentVersion): Promise<string> {
    if (!this.versionCollection) {
      throw new Error("Version collection not initialized");
    }

    const id = version.id || uuidv4();
    const versionWithId = { ...version, id };

    await this.versionCollection.add({
      ids: [id],
      metadatas: [this.serializeVersionMetadata(versionWithId)],
      documents: [version.content],
    });

    return id;
  }

  /**
   * Get component versions
   */
  async getComponentVersions(componentId: string): Promise<ComponentVersion[]> {
    if (!this.versionCollection) {
      throw new Error("Version collection not initialized");
    }

    const results = await this.versionCollection.query({
      queryTexts: [componentId],
      nResults: 100
    });

    if (!results?.metadatas?.[0]) {
      return [];
    }

    return results.metadatas[0]
      .map((metadata) => this.deserializeVersionMetadata(metadata as Metadata))
      .filter((version): version is ComponentVersion => version !== null);
  }

  /**
   * Get component version diff
   */
  async getComponentVersionDiff(
    componentId: string,
    versionId1: string,
    versionId2: string,
  ): Promise<{ additions: Array<{ line: number; content: string }>; deletions: Array<{ line: number; content: string }> }> {
    if (!this.versionCollection) {
      throw new Error("Version collection not initialized");
    }

    const results = await this.versionCollection.get({
      ids: [versionId1, versionId2],
    });

    if (!results.metadatas || results.metadatas.length < 2) {
      throw new Error("One or both versions not found");
    }

    const version1Data = this.deserializeVersionMetadata(results.metadatas[0] as Metadata);
    const version2Data = this.deserializeVersionMetadata(results.metadatas[1] as Metadata);

    if (!version1Data || !version2Data) {
      throw new Error("Could not deserialize version metadata");
    }

    // Simple line-by-line diff
    const lines1 = version1Data.content.split("\n");
    const lines2 = version2Data.content.split("\n");

    const additions = [];
    const deletions = [];

    // Find deletions (lines in version1 but not in version2)
    for (let i = 0; i < lines1.length; i++) {
      if (!lines2.includes(lines1[i])) {
        deletions.push({ line: i + 1, content: lines1[i] });
      }
    }

    // Find additions (lines in version2 but not in version1)
    for (let i = 0; i < lines2.length; i++) {
      if (!lines1.includes(lines2[i])) {
        additions.push({ line: i + 1, content: lines2[i] });
      }
    }

    return { additions, deletions };
  }

  /**
   * Add a learning task
   */
  async addLearningTask(task: LearningTask): Promise<string> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    const id = task.id || uuidv4();
    const taskWithId = { ...task, id };

    await this.learningCollection.add({
      ids: [id],
      metadatas: [this.serializeTaskMetadata(taskWithId)],
      documents: [`${task.title}: ${task.description}`],
    });

    return id;
  }

  /**
   * Get learning tasks
   */
  async getLearningTasks(): Promise<LearningTask[]> {
    return this.retry(async () => {
      if (!this.learningCollection) {
        throw new Error("Learning collection not initialized");
      }

      const results = await this.learningCollection.query({
        queryTexts: ["*"],  // Query all tasks
        nResults: 100,
      });

      if (!results?.metadatas?.[0]) {
        return [];
      }

      return results.metadatas[0]
        .map((metadata) => this.deserializeTaskMetadata(metadata as Metadata))
        .filter((task): task is LearningTask => task !== null);
    }, 'getLearningTasks');
  }

  /**
   * Add an exemplar solution
   */
  async addExemplarSolution(solution: ExemplarSolution): Promise<string> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    const id = solution.id || uuidv4();
    const solutionWithId = { ...solution, id };

    await this.learningCollection.add({
      ids: [id],
      metadatas: [this.serializeMetadata(solutionWithId)],
      documents: [solution.content],
    });

    return id;
  }

  /**
   * Get exemplar solutions for a task
   */
  async getExemplarSolutions(taskId: string): Promise<ExemplarSolution[]> {
    if (!this.learningCollection) {
      throw new Error('Learning collection not initialized');
    }

    const results = await this.learningCollection.query({
      queryTexts: [taskId],
      nResults: 100,
    });

    return this.mapMetadataArray(results.metadatas?.[0] || [], (metadata) => {
      const deserialized = this.deserializeMetadata(metadata);
      if (!deserialized) return null;
      
      const now = Date.now();
      const tags = Array.isArray(metadata.tags) ? metadata.tags as string[] : undefined;
      const dependencies = Array.isArray(metadata.dependencies) ? metadata.dependencies as string[] : undefined;
      const relationships = typeof metadata.relationships === 'object' && metadata.relationships !== null
        ? {
            dependsOn: Array.isArray((metadata.relationships as any).dependsOn) ? (metadata.relationships as any).dependsOn : [],
            usedBy: Array.isArray((metadata.relationships as any).usedBy) ? (metadata.relationships as any).usedBy : [],
            extends: Array.isArray((metadata.relationships as any).extends) ? (metadata.relationships as any).extends : [],
            implements: Array.isArray((metadata.relationships as any).implements) ? (metadata.relationships as any).implements : [],
          }
        : undefined;

      const solution: ExemplarSolution = {
        id: deserialized.id,
        type: 'plugin',
        name: deserialized.name,
        content: deserialized.content,
        ast: deserialized.ast,
        metadata: {
          path: metadata.path as string,
          description: metadata.description as string | undefined,
          tags,
          createdAt: (metadata.createdAt as number) || now,
          updatedAt: metadata.updatedAt as number | undefined,
          version: metadata.version as string | undefined,
          author: metadata.author as string || 'unknown',
          dependencies,
          relationships,
          taskId: metadata.taskId as string,
          explanation: metadata.explanation as string,
          quality: metadata.quality as number,
        },
      };

      return solution;
    });
  }

  /**
   * Get tasks by difficulty
   */
  async getTasksByDifficulty(difficulty: TaskDifficulty): Promise<LearningTask[]> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    const results = await this.learningCollection.query({
      queryTexts: [difficulty],
      nResults: 100,
    });

    return this.mapMetadataArray(results.metadatas?.[0] || [], (metadata) => {
      return this.deserializeTaskMetadata(metadata);
    });
  }

  /**
   * Get next recommended task
   */
  async getNextRecommendedTask(
    userId: string,
    completedTaskIds: string[],
  ): Promise<LearningTask | null> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    // Get all tasks
    const allTasks = await this.getLearningTasks();
    
    // Filter out completed tasks
    const incompleteTasks = allTasks.filter(task => !completedTaskIds.includes(task.id || ''));
    
    if (incompleteTasks.length === 0) {
      return null;
    }

    // Sort by difficulty and order
    const sortedTasks = incompleteTasks.sort((a, b) => {
      const difficultyOrder = {
        [TaskDifficulty.Beginner]: 0,
        [TaskDifficulty.Intermediate]: 1,
        [TaskDifficulty.Advanced]: 2,
        [TaskDifficulty.Expert]: 3,
      };
      
      const diffCompare = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      if (diffCompare !== 0) return diffCompare;
      
      return (a.order || 0) - (b.order || 0);
    });

    // Return the first incomplete task
    return sortedTasks[0];
  }

  private mapMetadataArray<T>(metadataArray: (Metadata | null)[] | undefined | null, mapper: (metadata: Metadata) => T | null): T[] {
    if (!metadataArray) return [];

    return metadataArray
      .filter((metadata): metadata is Metadata => metadata !== null)
      .map(mapper)
      .filter((item): item is T => item !== null);
  }
}
