/**
 * @file Component versioning system implementation
 * @module @architectlm/rag
 */

import {
  Component,
  ComponentVersion,
  ComponentEvolution,
  VersionDiff,
  VectorDBConnector,
} from "../models.js";

/**
 * Component versioning system for tracking how components evolve over time
 */
export class ComponentVersioningSystem {
  private vectorDB: VectorDBConnector;

  /**
   * Create a new component versioning system
   */
  constructor(vectorDB: VectorDBConnector) {
    this.vectorDB = vectorDB;
  }

  /**
   * Create a new version of a component
   */
  async createVersion(
    component: Component,
    previousContent: string,
    changeDescription: string,
    author: string,
  ): Promise<string> {
    // Get existing versions to determine the next version number
    const existingVersions = await this.getVersionHistory(component.id || "");
    const versionNumber =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.versionNumber)) + 1
        : 1;

    const version: ComponentVersion = {
      componentId: component.id || "",
      versionNumber,
      content: component.content,
      previousContent,
      changeDescription,
      author,
      timestamp: Date.now(),
    };

    return this.vectorDB.createComponentVersion(version);
  }

  /**
   * Get version history for a component
   */
  async getVersionHistory(componentId: string): Promise<ComponentVersion[]> {
    const versions = await this.vectorDB.getComponentVersions(componentId);

    // Sort versions by version number
    return versions.sort((a, b) => a.versionNumber - b.versionNumber);
  }

  /**
   * Compare two versions of a component
   */
  async compareVersions(
    componentId: string,
    versionId1: string,
    versionId2: string,
  ): Promise<VersionDiff> {
    return this.vectorDB.getComponentVersionDiff(
      componentId,
      versionId1,
      versionId2,
    );
  }

  /**
   * Analyze the evolution of a component
   */
  async analyzeComponentEvolution(
    componentId: string,
  ): Promise<ComponentEvolution> {
    const versions = await this.getVersionHistory(componentId);

    if (versions.length === 0) {
      throw new Error(`No versions found for component ${componentId}`);
    }

    // Calculate total versions
    const totalVersions = versions.length;

    // Calculate change frequency (changes per day)
    const firstVersion = versions[0];
    const lastVersion = versions[versions.length - 1];
    const timeSpanDays =
      (lastVersion.timestamp - firstVersion.timestamp) / (1000 * 60 * 60 * 24);
    const changeFrequency =
      timeSpanDays > 0 ? totalVersions / timeSpanDays : totalVersions; // If all changes happened on the same day

    // Find common authors
    const authorFrequency = new Map<string, number>();
    for (const version of versions) {
      authorFrequency.set(
        version.author,
        (authorFrequency.get(version.author) || 0) + 1,
      );
    }

    const commonAuthors = Array.from(authorFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([author]) => author);

    // Find common changes
    const changePatterns = this.extractChangePatterns(versions);

    // Calculate complexity trend
    const complexity = this.calculateComplexityTrend(versions);

    return {
      componentId,
      totalVersions,
      changeFrequency,
      commonAuthors,
      commonChanges: changePatterns,
      complexity,
    };
  }

  /**
   * Extract common change patterns from version history
   */
  private extractChangePatterns(versions: ComponentVersion[]): string[] {
    const patterns = new Map<string, number>();

    // Look for common patterns in change descriptions
    for (const version of versions) {
      const description = version.changeDescription.toLowerCase();

      // Common change patterns to look for
      const changeTypes = [
        "refactor",
        "optimize",
        "fix",
        "add",
        "remove",
        "update",
        "error handling",
        "validation",
        "performance",
        "security",
        "documentation",
        "test",
        "feature",
        "bug fix",
        "enhancement",
      ];

      for (const changeType of changeTypes) {
        if (description.includes(changeType)) {
          patterns.set(changeType, (patterns.get(changeType) || 0) + 1);
        }
      }
    }

    // Return the most common patterns
    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  /**
   * Calculate complexity trend based on version history
   */
  private calculateComplexityTrend(versions: ComponentVersion[]): {
    initial: number;
    current: number;
    trend: "increasing" | "decreasing" | "stable";
  } {
    if (versions.length < 2) {
      return {
        initial: this.estimateComplexity(versions[0].content),
        current: this.estimateComplexity(versions[0].content),
        trend: "stable",
      };
    }

    const firstVersion = versions[0];
    const lastVersion = versions[versions.length - 1];

    const initialComplexity = this.estimateComplexity(firstVersion.content);
    const currentComplexity = this.estimateComplexity(lastVersion.content);

    // Determine trend
    let trend: "increasing" | "decreasing" | "stable";

    if (currentComplexity > initialComplexity * 1.1) {
      trend = "increasing";
    } else if (currentComplexity < initialComplexity * 0.9) {
      trend = "decreasing";
    } else {
      trend = "stable";
    }

    return {
      initial: initialComplexity,
      current: currentComplexity,
      trend,
    };
  }

  /**
   * Estimate code complexity based on simple metrics
   */
  private estimateComplexity(code: string): number {
    // Simple complexity estimation based on:
    // 1. Code length
    // 2. Number of conditionals (if, switch, ternary)
    // 3. Number of loops (for, while)
    // 4. Number of function calls

    const length = code.length;

    // Count conditionals
    const conditionals = (code.match(/if\s*\(|switch\s*\(|\?/g) || []).length;

    // Count loops
    const loops = (
      code.match(/for\s*\(|while\s*\(|forEach|map|filter|reduce|every|some/g) ||
      []
    ).length;

    // Count function calls (simplified)
    const functionCalls = (code.match(/\w+\s*\(/g) || []).length;

    // Count nesting level (simplified by counting braces)
    const openBraces = (code.match(/\{/g) || []).length;

    // Weighted complexity score
    return (
      length * 0.01 +
      conditionals * 3 +
      loops * 5 +
      functionCalls * 1 +
      openBraces * 2
    );
  }
}
