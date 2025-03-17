import { describe, it, expect, vi, beforeEach } from "vitest";
import { Component, ComponentType } from "../../src/models.js";
import { SessionManager } from "../../src/cli/session-manager.js";
import { CliCommandHandler } from "../../src/cli/cli-command-handler.js";

// Mock dependencies
vi.mock("../../src/cli/cli-command-handler.js");

describe("SessionManager", () => {
  let sessionManager: SessionManager;
  let mockCliCommandHandler: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create mock instances
    mockCliCommandHandler = {
      processCommand: vi.fn(),
      commitCode: vi.fn(),
      provideFeedback: vi.fn(),
    };

    // Setup mock implementations
    mockCliCommandHandler.processCommand.mockResolvedValue({
      component: {
        id: "component-1",
        type: ComponentType.Function,
        name: "processUserJourney",
        content: "function processUserJourney() { /* implementation */ }",
        metadata: {
          path: "src/functions/user-journey.ts",
          description: "Processes a user journey for US users with discount",
        },
      },
      validationResult: {
        isValid: true,
      },
    });

    mockCliCommandHandler.commitCode.mockResolvedValue({
      success: true,
      message: "Component successfully committed",
    });

    mockCliCommandHandler.provideFeedback.mockResolvedValue({
      component: {
        id: "component-1",
        type: ComponentType.Function,
        name: "processUserJourney",
        content: "function processUserJourney() { /* improved version */ }",
        metadata: {
          path: "src/functions/user-journey.ts",
          description: "Processes a user journey for US users with discount",
        },
      },
      validationResult: {
        isValid: true,
      },
    });

    // Create the session manager with mocked dependencies
    sessionManager = new SessionManager(mockCliCommandHandler);
  });

  describe("GIVEN a new session is started", () => {
    describe("WHEN the user enters a command", () => {
      it("THEN the session should process the command and store the result", async () => {
        // Execute command
        const result = await sessionManager.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
          []
        );

        // Verify command handler was called
        expect(mockCliCommandHandler.processCommand).toHaveBeenCalledWith(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
          []
        );

        // Verify result
        expect(result).toHaveProperty("component");
        expect(result.component.name).toBe("processUserJourney");

        // Verify session state
        expect(sessionManager.getCurrentComponent()).toEqual(result.component);
        expect(sessionManager.getHistory()).toHaveLength(1);
      });
    });
  });

  describe("GIVEN a session with a generated component", () => {
    describe("WHEN the user commits the component", () => {
      it("THEN the session should commit the component and update history", async () => {
        // First generate a component
        await sessionManager.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Then commit it
        const commitResult = await sessionManager.commitCurrentComponent();

        // Verify command handler was called
        expect(mockCliCommandHandler.commitCode).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "processUserJourney",
          }),
        );

        // Verify result
        expect(commitResult.success).toBe(true);

        // Verify session state
        expect(sessionManager.getHistory()).toHaveLength(2); // Initial command + commit
      });
    });

    describe("WHEN the user provides feedback", () => {
      it("THEN the session should update the component with feedback", async () => {
        // First generate a component
        await sessionManager.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Then provide feedback
        const feedbackResult = await sessionManager.provideFeedback(
          "Please add input validation for the user's country",
        );

        // Verify command handler was called
        expect(mockCliCommandHandler.provideFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "processUserJourney",
          }),
          "Please add input validation for the user's country",
        );

        // Verify result
        expect(feedbackResult.component.content).toContain("improved version");

        // Verify session state
        expect(sessionManager.getCurrentComponent()).toEqual(
          feedbackResult.component,
        );
        expect(sessionManager.getHistory()).toHaveLength(2); // Initial command + feedback
      });
    });
  });

  describe("GIVEN a session with multiple commands", () => {
    describe("WHEN the user requests the command history", () => {
      it("THEN the session should return the complete history", async () => {
        // Execute multiple commands
        await sessionManager.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        await sessionManager.provideFeedback(
          "Please add input validation for the user's country",
        );

        await sessionManager.commitCurrentComponent();

        // Get history
        const history = sessionManager.getHistory();

        // Verify history
        expect(history).toHaveLength(3);
        expect(history[0].type).toBe("command");
        expect(history[1].type).toBe("feedback");
        expect(history[2].type).toBe("commit");
      });
    });

    describe("WHEN the user wants to undo the last action", () => {
      it("THEN the session should revert to the previous state", async () => {
        // Execute commands
        const initialResult = await sessionManager.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        await sessionManager.provideFeedback(
          "Please add input validation for the user's country",
        );

        // Undo the feedback
        const undoResult = await sessionManager.undo();

        // Verify undo result
        expect(undoResult).toBe(true);

        // Verify session state reverted
        expect(sessionManager.getCurrentComponent()).toEqual(
          initialResult.component,
        );
        expect(sessionManager.getHistory()).toHaveLength(1);
      });
    });
  });
});
