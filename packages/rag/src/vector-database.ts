/**
 * Vector Database Interface
 * 
 * This file defines the interface for vector database operations in the RAG system.
 */

import { SearchOptions, SearchResult } from './models.js';

/**
 * Interface for vector database
 */
export interface VectorDatabase {
  /**
   * Add an embedding to the vector database
   */
  addEmbedding(id: string, embedding: number[], metadata?: any): Promise<boolean>;
  
  /**
   * Search for similar embeddings
   */
  search(query: string | number[], limit?: number): Promise<Array<{id: string, score: number}>>;
  
  /**
   * Remove an embedding from the vector database
   */
  removeEmbedding(id: string): Promise<boolean>;
}