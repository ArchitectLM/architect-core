import { describe, it, expect, vi, beforeEach } from "vitest";
import { GuidedLearningSystem } from "../../src/learning/guided-learning.js";
import { ChromaDBConnector } from "../../src/vector-db/chroma-connector.js";
import {
  Component,
  ComponentType,
  LearningTask,
  TaskDifficulty,
  ExemplarSolution,
} from "../../src/models.js";

describe("Guided Learning System", () => {
  let learningSystem: GuidedLearningSystem;
  let mockVectorDB: ChromaDBConnector;

  beforeEach(() => {
    // Mock the vector database
    mockVectorDB = {
      initialize: vi.fn().mockResolvedValue(undefined),
      addDocument: vi.fn().mockResolvedValue("doc-id-1"),
      addDocuments: vi.fn().mockResolvedValue(["doc-id-1", "doc-id-2"]),
      search: vi.fn().mockResolvedValue([]),
      getDocument: vi.fn().mockResolvedValue(null),
      updateDocument: vi.fn().mockResolvedValue(undefined),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
      deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
      addLearningTask: vi.fn().mockResolvedValue("task-id-1"),
      getLearningTasks: vi.fn().mockResolvedValue([]),
      addExemplarSolution: vi.fn().mockResolvedValue("exemplar-id-1"),
      getExemplarSolutions: vi.fn().mockResolvedValue([]),
      getTasksByDifficulty: vi.fn().mockResolvedValue([]),
      getNextRecommendedTask: vi.fn().mockResolvedValue(null),
    } as unknown as ChromaDBConnector;

    learningSystem = new GuidedLearningSystem(mockVectorDB);
  });

  describe("GIVEN a guided learning system", () => {
    describe("WHEN creating a learning task", () => {
      it("THEN should store the task in the vector database", async () => {
        // Arrange
        const task: LearningTask = {
          title: "Implement error handling in payment processing",
          description:
            "Add try/catch blocks to handle potential errors in the payment processing function",
          difficulty: TaskDifficulty.Intermediate,
          prerequisites: ["basic-function-creation"],
          relatedComponentIds: ["component-id-1"],
          tags: ["error-handling", "payment"],
          createdAt: Date.now(),
        };

        // Act
        await learningSystem.createLearningTask(task);

        // Assert
        expect(mockVectorDB.addLearningTask).toHaveBeenCalledWith(task);
      });
    });

    describe("WHEN adding an exemplar solution", () => {
      it("THEN should store the exemplar in the vector database", async () => {
        // Arrange
        const taskId = "task-id-1";
        const solution: ExemplarSolution = {
          taskId,
          content:
            "function processPayment() { try { /* ... */ } catch (e) { /* ... */ } }",
          explanation:
            "This solution adds proper error handling by using try/catch blocks to catch potential exceptions",
          author: "expert-user",
          quality: 5,
          createdAt: Date.now(),
        };

        // Act
        await learningSystem.addExemplarSolution(solution);

        // Assert
        expect(mockVectorDB.addExemplarSolution).toHaveBeenCalledWith(solution);
      });
    });

    describe("WHEN retrieving tasks by difficulty", () => {
      it("THEN should return tasks matching the specified difficulty level", async () => {
        // Arrange
        const difficulty = TaskDifficulty.Intermediate;
        const mockTasks = [
          {
            id: "task-id-1",
            title: "Implement error handling",
            difficulty: TaskDifficulty.Intermediate,
            createdAt: Date.now() - 1000,
          },
          {
            id: "task-id-2",
            title: "Add validation to input parameters",
            difficulty: TaskDifficulty.Intermediate,
            createdAt: Date.now(),
          },
        ];

        mockVectorDB.getTasksByDifficulty = vi
          .fn()
          .mockResolvedValue(mockTasks);

        // Act
        const tasks = await learningSystem.getTasksByDifficulty(difficulty);

        // Assert
        expect(mockVectorDB.getTasksByDifficulty).toHaveBeenCalledWith(
          difficulty,
        );
        expect(tasks).toEqual(mockTasks);
      });
    });

    describe("WHEN retrieving exemplar solutions for a task", () => {
      it("THEN should return all exemplars for the specified task", async () => {
        // Arrange
        const taskId = "task-id-1";
        const mockExemplars = [
          {
            id: "exemplar-id-1",
            taskId,
            content:
              "function processPayment() { try { /* ... */ } catch (e) { /* ... */ } }",
            explanation: "Solution with basic error handling",
            author: "expert-1",
            quality: 4,
            createdAt: Date.now() - 1000,
          },
          {
            id: "exemplar-id-2",
            taskId,
            content:
              "function processPayment() { try { /* ... */ } catch (e) { logger.error(e); /* ... */ } }",
            explanation: "Solution with error logging",
            author: "expert-2",
            quality: 5,
            createdAt: Date.now(),
          },
        ];

        mockVectorDB.getExemplarSolutions = vi
          .fn()
          .mockResolvedValue(mockExemplars);

        // Act
        const exemplars = await learningSystem.getExemplarSolutions(taskId);

        // Assert
        expect(mockVectorDB.getExemplarSolutions).toHaveBeenCalledWith(taskId);
        expect(exemplars).toEqual(mockExemplars);
      });
    });

    describe("WHEN getting the next recommended task", () => {
      it("THEN should return a task appropriate for the user's skill level", async () => {
        // Arrange
        const userId = "user-123";
        const completedTaskIds = ["task-id-1", "task-id-2"];
        const mockNextTask = {
          id: "task-id-3",
          title: "Implement retry logic for failed payments",
          description:
            "Add retry mechanism with exponential backoff for payment processing failures",
          difficulty: TaskDifficulty.Advanced,
          prerequisites: ["error-handling-basics", "async-programming"],
          relatedComponentIds: ["component-id-1"],
          tags: ["retry-logic", "payment", "resilience"],
          createdAt: Date.now(),
        };

        mockVectorDB.getNextRecommendedTask = vi
          .fn()
          .mockResolvedValue(mockNextTask);

        // Act
        const nextTask = await learningSystem.getNextRecommendedTask(
          userId,
          completedTaskIds,
        );

        // Assert
        expect(mockVectorDB.getNextRecommendedTask).toHaveBeenCalledWith(
          userId,
          completedTaskIds,
        );
        expect(nextTask).toEqual(mockNextTask);
      });
    });

    describe("WHEN generating a learning path", () => {
      it("THEN should return a sequence of tasks that build on each other", async () => {
        // Arrange
        const userId = "user-123";
        const targetSkill = "payment-processing-expert";
        const mockTasks = [
          {
            id: "task-id-1",
            title: "Basic payment function",
            difficulty: TaskDifficulty.Beginner,
            prerequisites: [],
            order: 1,
          },
          {
            id: "task-id-2",
            title: "Add validation",
            difficulty: TaskDifficulty.Beginner,
            prerequisites: ["task-id-1"],
            order: 2,
          },
          {
            id: "task-id-3",
            title: "Implement error handling",
            difficulty: TaskDifficulty.Intermediate,
            prerequisites: ["task-id-2"],
            order: 3,
          },
          {
            id: "task-id-4",
            title: "Add retry logic",
            difficulty: TaskDifficulty.Advanced,
            prerequisites: ["task-id-3"],
            order: 4,
          },
          {
            id: "task-id-5",
            title: "Implement circuit breaker",
            difficulty: TaskDifficulty.Expert,
            prerequisites: ["task-id-4"],
            order: 5,
          },
        ];

        mockVectorDB.getLearningTasks = vi.fn().mockResolvedValue(mockTasks);

        // Act
        const learningPath = await learningSystem.generateLearningPath(
          userId,
          targetSkill,
        );

        // Assert
        expect(learningPath).toBeDefined();
        expect(learningPath.tasks.length).toBe(5);
        expect(learningPath.tasks[0].id).toBe("task-id-1");
        expect(learningPath.tasks[4].id).toBe("task-id-5");
        expect(learningPath.estimatedTimeToComplete).toBeGreaterThan(0);
      });
    });
  });
});
