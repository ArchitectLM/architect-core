/**
 * @file Base vector database connector interface
 * @module @architectlm/rag
 */

import {
  Component,
  SearchOptions,
  SearchResult,
  FeedbackRecord,
  RetrievalRecord,
  RetrievalOutcome,
  ComponentVersion,
  VersionDiff,
  LearningTask,
  ExemplarSolution,
  TaskDifficulty,
  ComponentType,
} from '../models';

/**
 * Base interface for vector database connectors
 */
export interface VectorDBConnector {
  /**
   * Initialize the connector
   */
  initialize(): Promise<void>;

  /**
   * Add a document to the vector database
   */
  addDocument(document: Component): Promise<string>;

  /**
   * Add multiple documents to the vector database
   */
  addDocuments(documents: Component[]): Promise<string[]>;

  /**
   * Search for similar documents
   */
  search(
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
  ): Promise<SearchResult[]>;

  /**
   * Get a document by ID
   */
  getDocument(id: string): Promise<Component | null>;

  /**
   * Update a document
   */
  updateDocument(id: string, document: Partial<Component>): Promise<void>;

  /**
   * Delete a document
   */
  deleteDocument(id: string): Promise<void>;

  /**
   * Delete all documents
   */
  deleteAllDocuments(): Promise<void>;

  /**
   * Add feedback for a component
   */
  addFeedback(feedback: FeedbackRecord): Promise<string>;

  /**
   * Get feedback for a component
   */
  getFeedbackForComponent(componentId: string): Promise<FeedbackRecord[]>;

  /**
   * Search for feedback
   */
  searchFeedback(
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
  ): Promise<FeedbackRecord[]>;

  /**
   * Record a retrieval
   */
  recordRetrieval(retrieval: RetrievalRecord): Promise<string>;

  /**
   * Update a retrieval outcome
   */
  updateRetrievalOutcome(
    retrievalId: string,
    outcome: RetrievalOutcome,
  ): Promise<void>;

  /**
   * Get retrievals by query
   */
  getRetrievalsByQuery(query: string): Promise<RetrievalRecord[]>;

  /**
   * Get successful retrievals
   */
  getSuccessfulRetrievals(query: string): Promise<RetrievalRecord[]>;

  /**
   * Create a component version
   */
  createComponentVersion(version: ComponentVersion): Promise<string>;

  /**
   * Get component versions
   */
  getComponentVersions(componentId: string): Promise<ComponentVersion[]>;

  /**
   * Get component version diff
   */
  getComponentVersionDiff(
    componentId: string,
    versionId1: string,
    versionId2: string,
  ): Promise<VersionDiff>;

  /**
   * Add a learning task
   */
  addLearningTask(task: LearningTask): Promise<string>;

  /**
   * Get learning tasks
   */
  getLearningTasks(): Promise<LearningTask[]>;

  /**
   * Add an exemplar solution
   */
  addExemplarSolution(solution: ExemplarSolution): Promise<string>;

  /**
   * Get exemplar solutions
   */
  getExemplarSolutions(taskId: string): Promise<ExemplarSolution[]>;

  /**
   * Get tasks by difficulty
   */
  getTasksByDifficulty(difficulty: TaskDifficulty): Promise<LearningTask[]>;

  /**
   * Get next recommended task
   */
  getNextRecommendedTask(
    userId: string,
    completedTaskIds: string[],
  ): Promise<LearningTask | null>;
} 