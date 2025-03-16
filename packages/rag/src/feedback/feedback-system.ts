/**
 * @file Feedback system implementation
 * @module @architectlm/rag
 */

import {
  FeedbackRecord,
  FeedbackInsights,
  VectorDBConnector,
} from "../models.js";

/**
 * Feedback system for capturing success/failure of LLM-generated changes
 */
export class FeedbackSystem {
  private vectorDB: VectorDBConnector;

  /**
   * Create a new feedback system
   */
  constructor(vectorDB: VectorDBConnector) {
    this.vectorDB = vectorDB;
  }

  /**
   * Record feedback for a component change
   */
  async recordFeedback(feedback: FeedbackRecord): Promise<string> {
    return this.vectorDB.addFeedback(feedback);
  }

  /**
   * Get feedback for a component
   */
  async getFeedbackForComponent(
    componentId: string,
  ): Promise<FeedbackRecord[]> {
    return this.vectorDB.getFeedbackForComponent(componentId);
  }

  /**
   * Analyze feedback patterns for a component
   */
  async analyzeFeedbackPatterns(
    componentId: string,
  ): Promise<FeedbackInsights> {
    const feedbackRecords = await this.getFeedbackForComponent(componentId);

    // Calculate success rate
    const totalFeedback = feedbackRecords.length;
    const successfulFeedback = feedbackRecords.filter(
      (feedback) => feedback.type === "success",
    ).length;
    const successRate =
      totalFeedback > 0 ? successfulFeedback / totalFeedback : 0;

    // Extract common patterns from successful changes
    const commonPatterns = this.extractCommonPatterns(feedbackRecords);

    // Extract risk factors from failed changes
    const riskFactors = this.extractRiskFactors(feedbackRecords);

    // Calculate metrics if available
    const metrics = this.calculateMetrics(feedbackRecords);

    return {
      componentId,
      successRate,
      commonPatterns,
      riskFactors,
      improvementSuggestions:
        this.generateImprovementSuggestions(feedbackRecords),
      metrics,
    };
  }

  /**
   * Extract common patterns from feedback records
   */
  private extractCommonPatterns(feedbackRecords: FeedbackRecord[]): string[] {
    const successfulFeedback = feedbackRecords.filter(
      (feedback) => feedback.type === "success",
    );

    // Extract keywords from messages
    const keywords = new Map<string, number>();

    for (const feedback of successfulFeedback) {
      const message = feedback.message.toLowerCase();

      // Look for common programming patterns in the messages
      const patterns = [
        "null check",
        "error handling",
        "validation",
        "logging",
        "performance",
        "refactor",
        "simplify",
        "optimize",
        "async",
        "promise",
        "callback",
        "event",
        "type",
        "interface",
        "class",
        "function",
      ];

      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          keywords.set(pattern, (keywords.get(pattern) || 0) + 1);
        }
      }
    }

    // Sort by frequency and return top patterns
    return Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  /**
   * Extract risk factors from feedback records
   */
  private extractRiskFactors(feedbackRecords: FeedbackRecord[]): string[] {
    const failedFeedback = feedbackRecords.filter(
      (feedback) => feedback.type === "failure",
    );

    // Extract keywords from messages
    const keywords = new Map<string, number>();

    for (const feedback of failedFeedback) {
      const message = feedback.message.toLowerCase();

      // Look for common risk factors in the messages
      const riskFactors = [
        "API contract",
        "breaking change",
        "compatibility",
        "performance regression",
        "memory leak",
        "race condition",
        "security",
        "authentication",
        "authorization",
        "input validation",
        "error handling",
        "exception",
        "timeout",
        "deadlock",
        "infinite loop",
      ];

      for (const risk of riskFactors) {
        if (message.toLowerCase().includes(risk.toLowerCase())) {
          keywords.set(risk, (keywords.get(risk) || 0) + 1);
        }
      }
    }

    // Sort by frequency and return top risk factors
    return Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([risk]) => risk);
  }

  /**
   * Calculate metrics from feedback records
   */
  private calculateMetrics(feedbackRecords: FeedbackRecord[]): {
    averageExecutionTime?: number;
    averageMemoryUsage?: number;
  } {
    const metrics = {
      executionTimes: [] as number[],
      memoryUsages: [] as number[],
    };

    // Collect metrics from feedback records
    for (const feedback of feedbackRecords) {
      if (feedback.metrics) {
        if (feedback.metrics.executionTime !== undefined) {
          metrics.executionTimes.push(feedback.metrics.executionTime);
        }

        if (feedback.metrics.memoryUsage !== undefined) {
          metrics.memoryUsages.push(feedback.metrics.memoryUsage);
        }
      }
    }

    // Calculate averages
    const result: {
      averageExecutionTime?: number;
      averageMemoryUsage?: number;
    } = {};

    if (metrics.executionTimes.length > 0) {
      result.averageExecutionTime =
        metrics.executionTimes.reduce((sum, time) => sum + time, 0) /
        metrics.executionTimes.length;
    }

    if (metrics.memoryUsages.length > 0) {
      result.averageMemoryUsage =
        metrics.memoryUsages.reduce((sum, usage) => sum + usage, 0) /
        metrics.memoryUsages.length;
    }

    return result;
  }

  /**
   * Generate improvement suggestions based on feedback
   */
  private generateImprovementSuggestions(
    feedbackRecords: FeedbackRecord[],
  ): string[] {
    const suggestions = new Set<string>();

    // Analyze failed feedback to generate suggestions
    const failedFeedback = feedbackRecords.filter(
      (feedback) => feedback.type === "failure",
    );

    for (const feedback of failedFeedback) {
      const message = feedback.message.toLowerCase();

      // Generate suggestions based on common failure patterns
      if (
        message.includes("api contract") ||
        message.includes("breaking change")
      ) {
        suggestions.add(
          "Ensure changes maintain backward compatibility with existing API contracts",
        );
      }

      if (message.includes("performance") || message.includes("slow")) {
        suggestions.add(
          "Consider performance implications of changes, especially for frequently called functions",
        );
      }

      if (message.includes("error") || message.includes("exception")) {
        suggestions.add(
          "Improve error handling to catch and properly handle all potential exceptions",
        );
      }

      if (message.includes("memory") || message.includes("leak")) {
        suggestions.add(
          "Check for potential memory leaks, especially in long-running processes",
        );
      }

      if (message.includes("security") || message.includes("vulnerability")) {
        suggestions.add(
          "Review changes for potential security vulnerabilities",
        );
      }
    }

    return Array.from(suggestions);
  }
}
