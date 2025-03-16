/**
 * @file Models for the RAG system
 * @module @architectlm/rag
 */

import { z } from "zod";

/**
 * Component types that can be indexed in the vector database
 */
export enum ComponentType {
  Function = "function",
  Command = "command",
  Event = "event",
  Query = "query",
  Schema = "schema",
  Pipeline = "pipeline",
  Extension = "extension",
}

/**
 * Schema for component metadata
 */
export const ComponentMetadataSchema = z.object({
  path: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Type for component metadata
 */
export type ComponentMetadata = z.infer<typeof ComponentMetadataSchema>;

/**
 * Schema for a component to be indexed
 */
export const ComponentSchema = z.object({
  id: z.string().optional(),
  type: z.nativeEnum(ComponentType),
  name: z.string(),
  content: z.string(),
  metadata: ComponentMetadataSchema,
});

/**
 * Type for a component to be indexed
 */
export type Component = z.infer<typeof ComponentSchema>;

/**
 * Schema for search options
 */
export const SearchOptionsSchema = z.object({
  limit: z.number().default(10),
  types: z.array(z.nativeEnum(ComponentType)).optional(),
  tags: z.array(z.string()).optional(),
  threshold: z.number().min(0).max(1).default(0.7),
});

/**
 * Type for search options
 */
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

/**
 * Schema for search results
 */
export const SearchResultSchema = z.object({
  component: ComponentSchema,
  score: z.number(),
  distance: z.number().optional(),
});

/**
 * Type for search results
 */
export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Schema for edit context
 */
export const EditContextSchema = z.object({
  query: z.string(),
  relevantComponents: z.array(ComponentSchema),
  suggestedChanges: z.array(
    z.object({
      componentId: z.string(),
      originalContent: z.string(),
      suggestedContent: z.string().optional(),
      reason: z.string(),
    }),
  ),
  globalContext: z.string().optional(),
});

/**
 * Type for edit context
 */
export type EditContext = z.infer<typeof EditContextSchema>;

/**
 * Schema for code validation result
 */
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        location: z
          .object({
            line: z.number().optional(),
            column: z.number().optional(),
            file: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  warnings: z
    .array(
      z.object({
        message: z.string(),
        location: z
          .object({
            line: z.number().optional(),
            column: z.number().optional(),
            file: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  suggestions: z.array(z.string()).optional(),
});

/**
 * Type for code validation result
 */
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Schema for vector database configuration
 */
export const VectorDBConfigSchema = z.object({
  collectionName: z.string(),
  persistDirectory: z.string().optional(),
  embeddingDimension: z.number().default(1536),
  distance: z.enum(["cosine", "euclidean", "dot"]).default("cosine"),
});

/**
 * Type for vector database configuration
 */
export type VectorDBConfig = z.infer<typeof VectorDBConfigSchema>;

/**
 * Interface for vector database connector
 */
export interface VectorDBConnector {
  /**
   * Initialize the vector database
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
   * Search for similar documents in the vector database
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Get a document by ID
   */
  getDocument(id: string): Promise<Component | null>;

  /**
   * Update a document in the vector database
   */
  updateDocument(id: string, document: Partial<Component>): Promise<void>;

  /**
   * Delete a document from the vector database
   */
  deleteDocument(id: string): Promise<void>;

  /**
   * Delete all documents from the vector database
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
    options?: SearchOptions,
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

/**
 * Feedback types
 */
export enum FeedbackType {
  Success = "success",
  Failure = "failure",
  Improvement = "improvement",
  Suggestion = "suggestion",
}

/**
 * Schema for feedback record
 */
export const FeedbackRecordSchema = z.object({
  id: z.string().optional(),
  componentId: z.string(),
  type: z.nativeEnum(FeedbackType),
  message: z.string(),
  originalContent: z.string().optional(),
  newContent: z.string().optional(),
  timestamp: z.number(),
  userId: z.string().optional(),
  metrics: z
    .object({
      executionTime: z.number().optional(),
      memoryUsage: z.number().optional(),
      cpuUsage: z.number().optional(),
      errorCount: z.number().optional(),
    })
    .optional(),
});

/**
 * Type for feedback record
 */
export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;

/**
 * Schema for feedback insights
 */
export const FeedbackInsightsSchema = z.object({
  componentId: z.string(),
  successRate: z.number(),
  commonPatterns: z.array(z.string()),
  riskFactors: z.array(z.string()),
  improvementSuggestions: z.array(z.string()).optional(),
  metrics: z
    .object({
      averageExecutionTime: z.number().optional(),
      averageMemoryUsage: z.number().optional(),
    })
    .optional(),
});

/**
 * Type for feedback insights
 */
export type FeedbackInsights = z.infer<typeof FeedbackInsightsSchema>;

/**
 * Schema for retrieval outcome
 */
export const RetrievalOutcomeSchema = z.object({
  successful: z.boolean(),
  usedComponentIds: z.array(z.string()),
  feedback: z.string().optional(),
  timestamp: z.number(),
});

/**
 * Type for retrieval outcome
 */
export type RetrievalOutcome = z.infer<typeof RetrievalOutcomeSchema>;

/**
 * Schema for retrieval record
 */
export const RetrievalRecordSchema = z.object({
  id: z.string().optional(),
  query: z.string(),
  timestamp: z.number(),
  retrievedComponentIds: z.array(z.string()),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  outcome: RetrievalOutcomeSchema.optional(),
  similarity: z.number().optional(),
});

/**
 * Type for retrieval record
 */
export type RetrievalRecord = z.infer<typeof RetrievalRecordSchema>;

/**
 * Schema for component version
 */
export const ComponentVersionSchema = z.object({
  id: z.string().optional(),
  componentId: z.string(),
  versionNumber: z.number(),
  content: z.string(),
  previousContent: z.string().optional(),
  changeDescription: z.string(),
  author: z.string(),
  timestamp: z.number(),
});

/**
 * Type for component version
 */
export type ComponentVersion = z.infer<typeof ComponentVersionSchema>;

/**
 * Schema for version diff
 */
export const VersionDiffSchema = z.object({
  additions: z.array(
    z.object({
      line: z.number(),
      content: z.string(),
    }),
  ),
  deletions: z.array(
    z.object({
      line: z.number(),
      content: z.string(),
    }),
  ),
});

/**
 * Type for version diff
 */
export type VersionDiff = z.infer<typeof VersionDiffSchema>;

/**
 * Schema for component evolution
 */
export const ComponentEvolutionSchema = z.object({
  componentId: z.string(),
  totalVersions: z.number(),
  changeFrequency: z.number(),
  commonAuthors: z.array(z.string()),
  commonChanges: z.array(z.string()),
  complexity: z.object({
    initial: z.number(),
    current: z.number(),
    trend: z.enum(["increasing", "decreasing", "stable"]),
  }),
});

/**
 * Type for component evolution
 */
export type ComponentEvolution = z.infer<typeof ComponentEvolutionSchema>;

/**
 * Task difficulty levels
 */
export enum TaskDifficulty {
  Beginner = "beginner",
  Intermediate = "intermediate",
  Advanced = "advanced",
  Expert = "expert",
}

/**
 * Schema for learning task
 */
export const LearningTaskSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  difficulty: z.nativeEnum(TaskDifficulty),
  prerequisites: z.array(z.string()).optional(),
  relatedComponentIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
  order: z.number().optional(),
});

/**
 * Type for learning task
 */
export type LearningTask = z.infer<typeof LearningTaskSchema>;

/**
 * Schema for exemplar solution
 */
export const ExemplarSolutionSchema = z.object({
  id: z.string().optional(),
  taskId: z.string(),
  content: z.string(),
  explanation: z.string(),
  author: z.string(),
  quality: z.number().min(1).max(5),
  createdAt: z.number(),
});

/**
 * Type for exemplar solution
 */
export type ExemplarSolution = z.infer<typeof ExemplarSolutionSchema>;

/**
 * Schema for learning path
 */
export const LearningPathSchema = z.object({
  userId: z.string(),
  targetSkill: z.string(),
  tasks: z.array(LearningTaskSchema),
  estimatedTimeToComplete: z.number(),
  createdAt: z.number(),
});

/**
 * Type for learning path
 */
export type LearningPath = z.infer<typeof LearningPathSchema>;
