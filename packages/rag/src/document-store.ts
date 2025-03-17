/**
 * Document Store Interface
 * 
 * This file defines the interface for document storage in the RAG system.
 */

import { Component } from './models.js';

/**
 * Interface for document store
 */
export interface DocumentStore {
  /**
   * Add a document to the store
   */
  addDocument(document: any): Promise<boolean>;
  
  /**
   * Get a document by ID
   */
  getDocument(id: string): Promise<any | null>;
  
  /**
   * Remove a document from the store
   */
  removeDocument(id: string): Promise<boolean>;
  
  /**
   * List all documents in the store
   */
  listDocuments(): Promise<any[]>;
} 