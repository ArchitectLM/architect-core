/**
 * @file ChromaDB connector implementation
 * @module @architectlm/rag
 */

import { ChromaClient, Collection } from "chromadb";
import { v4 as uuidv4 } from "uuid";
import {
  Component,
  ComponentType,
  SearchOptions,
  SearchOptionsSchema,
  SearchResult,
  VectorDBConfig,
  VectorDBConfigSchema,
  VectorDBConnector,
  FeedbackRecord,
  RetrievalRecord,
  RetrievalOutcome,
  ComponentVersion,
  VersionDiff,
  LearningTask,
  ExemplarSolution,
  TaskDifficulty,
} from "../models.js";

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

  /**
   * Create a new ChromaDB connector
   */
  constructor(config: VectorDBConfig) {
    this.config = VectorDBConfigSchema.parse(config);
    this.client = new ChromaClient({
      path: 'http://localhost:8000'
    });
  }

  private serializeMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean> {
    return Object.entries(metadata).reduce((acc, [key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = value;
      } else {
        acc[key] = JSON.stringify(value);
      }
      return acc;
    }, {} as Record<string, string | number | boolean>);
  }

  private deserializeMetadata(metadata: Record<string, string | number | boolean>): Record<string, unknown> {
    return Object.entries(metadata).reduce((acc, [key, value]) => {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          acc[key] = JSON.parse(value);
        } catch {
          acc[key] = value;
        }
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);
  }

  /**
   * Initialize the ChromaDB connector
   */
  async initialize(): Promise<void> {
    // Initialize main component collection
    this.collection = await this.client.getOrCreateCollection({
      name: this.config.collectionName,
      embeddingFunction: {
        generate: async (texts: string[]) => {
          // In a real implementation, this would use an embedding model
          // For now, we'll just return random embeddings for testing
          return texts.map(() =>
            Array.from({ length: this.config.embeddingDimension }, () =>
              Math.random(),
            ),
          );
        },
      },
    });

    // Initialize feedback collection
    this.feedbackCollection = await this.client.getOrCreateCollection({
      name: `${this.config.collectionName}-feedback`,
      embeddingFunction: {
        generate: async (texts: string[]) => {
          return texts.map(() =>
            Array.from({ length: this.config.embeddingDimension }, () =>
              Math.random(),
            ),
          );
        },
      },
    });

    // Initialize retrieval collection
    this.retrievalCollection = await this.client.getOrCreateCollection({
      name: `${this.config.collectionName}-retrievals`,
      embeddingFunction: {
        generate: async (texts: string[]) => {
          return texts.map(() =>
            Array.from({ length: this.config.embeddingDimension }, () =>
              Math.random(),
            ),
          );
        },
      },
    });

    // Initialize version collection
    this.versionCollection = await this.client.getOrCreateCollection({
      name: `${this.config.collectionName}-versions`,
      embeddingFunction: {
        generate: async (texts: string[]) => {
          return texts.map(() =>
            Array.from({ length: this.config.embeddingDimension }, () =>
              Math.random(),
            ),
          );
        },
      },
    });

    // Initialize learning collection
    this.learningCollection = await this.client.getOrCreateCollection({
      name: `${this.config.collectionName}-learning`,
      embeddingFunction: {
        generate: async (texts: string[]) => {
          return texts.map(() =>
            Array.from({ length: this.config.embeddingDimension }, () =>
              Math.random(),
            ),
          );
        },
      },
    });
  }

  /**
   * Add a document to the vector database
   */
  async addDocument(document: Component): Promise<string> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const id = document.id || uuidv4();
    const documentWithId = { ...document, id };

    await this.collection.add({
      ids: [id],
      metadatas: [this.serializeMetadata({ ...documentWithId })],
      documents: [document.content],
    });

    return id;
  }

  /**
   * Add multiple documents to the vector database
   */
  async addDocuments(documents: Component[]): Promise<string[]> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const ids = documents.map((doc) => doc.id || uuidv4());
    const documentsWithIds = documents.map((doc, index) => ({
      ...doc,
      id: ids[index],
    }));

    await this.collection.add({
      ids,
      metadatas: documentsWithIds.map((doc) => this.serializeMetadata({ ...doc })),
      documents: documents.map((doc) => doc.content),
    });

    return ids;
  }

  /**
   * Search for similar documents in the vector database
   */
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const parsedOptions = options
      ? SearchOptionsSchema.parse(options)
      : SearchOptionsSchema.parse({});

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: parsedOptions.limit,
      where: parsedOptions.types
        ? { type: { $in: parsedOptions.types } }
        : undefined,
    });

    if (!results.metadatas || !results.distances) {
      return [];
    }

    const metadatas = results.metadatas[0] || [];
    const distances = results.distances[0] || [];

    return metadatas
      .map((metadata: Record<string, string | number | boolean>, index: number) => {
        const deserializedMetadata = this.deserializeMetadata(metadata);
        const component = deserializedMetadata as unknown as Component;
        const distance = distances[index];

        // Filter by threshold
        if (distance > parsedOptions.threshold) {
          return null;
        }

        return {
          component,
          score: 1 - distance, // Convert distance to similarity score
          distance,
        };
      })
      .filter((result): result is SearchResult => result !== null);
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

    if (!result.metadatas || result.metadatas.length === 0) {
      return null;
    }

    return result.metadatas[0] as unknown as Component;
  }

  /**
   * Update a document in the vector database
   */
  async updateDocument(
    id: string,
    document: Partial<Component>,
  ): Promise<void> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

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
  }

  /**
   * Delete a document from the vector database
   */
  async deleteDocument(id: string): Promise<void> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    await this.collection.delete({
      ids: [id],
    });
  }

  /**
   * Delete all documents from the vector database
   */
  async deleteAllDocuments(): Promise<void> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    await this.collection.delete({
      where: {},
    });
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
      metadatas: [this.serializeMetadata({ ...feedbackWithId })],
      documents: [feedback.message],
    });

    return id;
  }

  /**
   * Get feedback for a component
   */
  async getFeedbackForComponent(
    componentId: string,
  ): Promise<FeedbackRecord[]> {
    if (!this.feedbackCollection) {
      throw new Error("Feedback collection not initialized");
    }

    const results = await this.feedbackCollection.get({
      where: { componentId },
    });

    if (!results.metadatas) {
      return [];
    }

    return results.metadatas.map(
      (metadata: Record<string, string | number | boolean>) =>
        this.deserializeMetadata(metadata) as unknown as FeedbackRecord,
    );
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

    if (!results.metadatas) {
      return [];
    }

    return (results.metadatas[0] || []).map(
      (metadata: Record<string, string | number | boolean>) =>
        this.deserializeMetadata(metadata) as unknown as FeedbackRecord,
    );
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
      metadatas: [this.serializeMetadata({ ...retrievalWithId })],
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

    const retrieval = results.metadatas[0] as unknown as RetrievalRecord;
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
      metadatas: [this.serializeMetadata({ ...updatedRetrieval })],
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

    // If query is empty, get all retrievals
    if (!query) {
      const results = await this.retrievalCollection.get({
        where: {},
      });

      if (!results.metadatas) {
        return [];
      }

      return results.metadatas.map(
        (metadata: Record<string, string | number | boolean>) =>
          this.deserializeMetadata(metadata) as unknown as RetrievalRecord,
      );
    }

    // Otherwise, search for similar queries
    const results = await this.retrievalCollection.query({
      queryTexts: [query],
      nResults: 100, // Get a large number to filter later
    });

    if (!results.metadatas) {
      return [];
    }

    return (results.metadatas[0] || []).map(
      (metadata: Record<string, string | number | boolean>) =>
        this.deserializeMetadata(metadata) as unknown as RetrievalRecord,
    );
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
      metadatas: [this.serializeMetadata({ ...versionWithId })],
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

    const results = await this.versionCollection.get({
      where: { componentId },
    });

    if (!results.metadatas) {
      return [];
    }

    return results.metadatas.map(
      (metadata: Record<string, string | number | boolean>) =>
        this.deserializeMetadata(metadata) as unknown as ComponentVersion,
    );
  }

  /**
   * Get component version diff
   */
  async getComponentVersionDiff(
    componentId: string,
    versionId1: string,
    versionId2: string,
  ): Promise<VersionDiff> {
    if (!this.versionCollection) {
      throw new Error("Version collection not initialized");
    }

    const results = await this.versionCollection.get({
      ids: [versionId1, versionId2],
    });

    if (!results.metadatas || results.metadatas.length < 2) {
      throw new Error("One or both versions not found");
    }

    const version1 = results.metadatas[0] as unknown as ComponentVersion;
    const version2 = results.metadatas[1] as unknown as ComponentVersion;

    // Simple line-by-line diff
    const lines1 = version1.content.split("\n");
    const lines2 = version2.content.split("\n");

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
      metadatas: [this.serializeMetadata({ ...taskWithId, type: "task" })],
      documents: [`${task.title}: ${task.description}`],
    });

    return id;
  }

  /**
   * Get learning tasks
   */
  async getLearningTasks(): Promise<LearningTask[]> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    const results = await this.learningCollection.get({
      where: { type: "task" },
    });

    if (!results.metadatas) {
      return [];
    }

    return results.metadatas.map((metadata: Record<string, string | number | boolean>) => {
      const { type, ...task } = this.deserializeMetadata(metadata) as unknown as LearningTask & {
        type: string;
      };
      return task;
    });
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
      metadatas: [this.serializeMetadata({ ...solutionWithId, type: "exemplar" })],
      documents: [solution.content],
    });

    return id;
  }

  /**
   * Get exemplar solutions
   */
  async getExemplarSolutions(taskId: string): Promise<ExemplarSolution[]> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    const results = await this.learningCollection.get({
      where: { taskId, type: "exemplar" },
    });

    if (!results.metadatas) {
      return [];
    }

    return results.metadatas.map((metadata: Record<string, string | number | boolean>) => {
      const { type, ...solution } = this.deserializeMetadata(metadata) as unknown as ExemplarSolution & {
        type: string;
      };
      return solution;
    });
  }

  /**
   * Get tasks by difficulty
   */
  async getTasksByDifficulty(
    difficulty: TaskDifficulty,
  ): Promise<LearningTask[]> {
    if (!this.learningCollection) {
      throw new Error("Learning collection not initialized");
    }

    const results = await this.learningCollection.get({
      where: { difficulty, type: "task" },
    });

    if (!results.metadatas) {
      return [];
    }

    return results.metadatas.map((metadata: Record<string, string | number | boolean>) => {
      const { type, ...task } = this.deserializeMetadata(metadata) as unknown as LearningTask & {
        type: string;
      };
      return task;
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
    const incompleteTasks = allTasks.filter(
      (task) => task.id && !completedTaskIds.includes(task.id),
    );

    if (incompleteTasks.length === 0) {
      return null;
    }

    // Find tasks with prerequisites that have been completed
    const availableTasks = incompleteTasks.filter((task) => {
      if (!task.prerequisites || task.prerequisites.length === 0) {
        return true;
      }

      return task.prerequisites.every((prereq) =>
        completedTaskIds.includes(prereq),
      );
    });

    if (availableTasks.length === 0) {
      return null;
    }

    // Sort by difficulty (easiest first)
    const sortedTasks = availableTasks.sort((a, b) => {
      const difficultyOrder = {
        [TaskDifficulty.Beginner]: 0,
        [TaskDifficulty.Intermediate]: 1,
        [TaskDifficulty.Advanced]: 2,
        [TaskDifficulty.Expert]: 3,
      };

      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });

    // Return the first available task
    return sortedTasks[0];
  }
}
