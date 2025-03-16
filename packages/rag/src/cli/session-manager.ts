/**
 * @file Session Manager implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType } from "../models.js";
import {
  CliCommandHandler,
  CommandResult,
  CommitResult,
} from "./cli-command-handler.js";

/**
 * Session history entry types
 */
export enum HistoryEntryType {
  Command = "command",
  Feedback = "feedback",
  Commit = "commit",
}

/**
 * Session history entry
 */
export interface HistoryEntry {
  type: HistoryEntryType;
  timestamp: number;
  command?: string;
  feedback?: string;
  componentType?: ComponentType;
  result?: CommandResult | CommitResult;
}

/**
 * Session Manager for maintaining state between commands
 */
export class SessionManager {
  private commandHandler: CliCommandHandler;
  private history: HistoryEntry[] = [];
  private currentComponent: Component | null = null;

  /**
   * Create a new Session Manager
   */
  constructor(commandHandler: CliCommandHandler) {
    this.commandHandler = commandHandler;
  }

  /**
   * Process a command from the user
   */
  async processCommand(
    command: string,
    componentType: ComponentType,
  ): Promise<CommandResult> {
    // Process the command
    const result = await this.commandHandler.processCommand(
      command,
      componentType,
    );

    // Update session state
    this.currentComponent = result.component;

    // Add to history
    this.history.push({
      type: HistoryEntryType.Command,
      timestamp: Date.now(),
      command,
      componentType,
      result,
    });

    return result;
  }

  /**
   * Commit the current component
   */
  async commitCurrentComponent(): Promise<CommitResult> {
    // Ensure there is a current component
    if (!this.currentComponent) {
      return {
        success: false,
        message: "No component to commit",
      };
    }

    // Commit the component
    const result = await this.commandHandler.commitCode(this.currentComponent);

    // Add to history
    this.history.push({
      type: HistoryEntryType.Commit,
      timestamp: Date.now(),
      result,
    });

    return result;
  }

  /**
   * Provide feedback to improve the current component
   */
  async provideFeedback(feedback: string): Promise<CommandResult> {
    // Ensure there is a current component
    if (!this.currentComponent) {
      throw new Error("No component to provide feedback for");
    }

    // Process the feedback
    const result = await this.commandHandler.provideFeedback(
      this.currentComponent,
      feedback,
    );

    // Update session state
    this.currentComponent = result.component;

    // Add to history
    this.history.push({
      type: HistoryEntryType.Feedback,
      timestamp: Date.now(),
      feedback,
      result,
    });

    return result;
  }

  /**
   * Undo the last action
   */
  async undo(): Promise<boolean> {
    // Ensure there is history to undo
    if (this.history.length <= 1) {
      return false;
    }

    // Remove the last entry
    this.history.pop();

    // Restore the previous state
    const lastEntry = this.history[this.history.length - 1];

    // Update current component based on the last entry
    if (
      lastEntry.type === HistoryEntryType.Command ||
      lastEntry.type === HistoryEntryType.Feedback
    ) {
      this.currentComponent = (lastEntry.result as CommandResult).component;
    } else {
      // If the last entry is a commit, we need to look further back
      for (let i = this.history.length - 2; i >= 0; i--) {
        const entry = this.history[i];
        if (
          entry.type === HistoryEntryType.Command ||
          entry.type === HistoryEntryType.Feedback
        ) {
          this.currentComponent = (entry.result as CommandResult).component;
          break;
        }
      }
    }

    return true;
  }

  /**
   * Get the current component
   */
  getCurrentComponent(): Component | null {
    return this.currentComponent;
  }

  /**
   * Get the session history
   */
  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear the session history
   */
  clearHistory(): void {
    this.history = [];
    this.currentComponent = null;
  }
}
