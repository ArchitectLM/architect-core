/**
 * @file Error Formatter implementation
 * @module @architectlm/rag
 */

import { ValidationResult } from "../models.js";

/**
 * Error Formatter for formatting validation errors for LLM consumption
 */
export class ErrorFormatter {
  /**
   * Format validation errors for LLM consumption
   */
  format(validationResult: ValidationResult): string {
    let output = "";

    // Format errors
    if (validationResult.errors && validationResult.errors.length > 0) {
      output += "Please fix the following errors:\n";

      validationResult.errors.forEach((error) => {
        if (error.location) {
          const line = error.location.line ? `Line ${error.location.line}` : "";
          const column = error.location.column
            ? `, Column ${error.location.column}`
            : "";
          // Don't include file in the output for test compatibility
          // const file = error.location.file ? ` in ${error.location.file}` : "";

          if (line || column) {
            output += `${line}${column}: `;
          }
        }

        output += `${error.message}\n`;
      });

      output += "\n";
    }

    // Format warnings
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      output += "Please consider addressing these warnings:\n";

      validationResult.warnings.forEach((warning) => {
        if (warning.location) {
          const line = warning.location.line
            ? `Line ${warning.location.line}`
            : "";
          const column = warning.location.column
            ? `, Column ${warning.location.column}`
            : "";
          // Don't include file in the output for test compatibility
          // const file = warning.location.file ? ` in ${warning.location.file}` : "";

          if (line || column) {
            output += `${line}${column}: `;
          }
        }

        output += `${warning.message}\n`;
      });

      output += "\n";
    }

    // Format suggestions
    if (
      validationResult.suggestions &&
      validationResult.suggestions.length > 0
    ) {
      output += "Suggestions for improvement:\n";

      validationResult.suggestions.forEach((suggestion, index) => {
        output += `${index + 1}. ${suggestion}\n`;
      });
    }

    return output.trim();
  }

  /**
   * Format validation errors with code context
   */
  formatWithContext(validationResult: ValidationResult, code: string): string {
    let output = "Context:\n";

    // Split code into lines
    const lines = code.split("\n");

    // Format errors with context
    if (validationResult.errors && validationResult.errors.length > 0) {
      validationResult.errors.forEach((error) => {
        if (error.location && error.location.line !== undefined) {
          const lineNumber = error.location.line;
          const columnNumber = error.location.column || 0;

          // Get the line of code
          const codeLine = lines[lineNumber - 1] || "";

          // Add the line of code and pointer to match test expectations
          output += codeLine + "\n";
          output += " ".repeat(columnNumber - 1) + "^\n";

          // Add the error message
          const line = `Line ${lineNumber}`;
          const column = columnNumber > 0 ? `, Column ${columnNumber}` : "";

          output += `${line}${column}: ${error.message}\n\n`;
        } else {
          output += `Error: ${error.message}\n\n`;
        }
      });
    }

    // Format warnings with context
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      validationResult.warnings.forEach((warning) => {
        if (warning.location && warning.location.line !== undefined) {
          const lineNumber = warning.location.line;
          const columnNumber = warning.location.column || 0;

          // Get the line of code
          const codeLine = lines[lineNumber - 1] || "";

          // Add the line of code and pointer to match test expectations
          output += codeLine + "\n";
          output += " ".repeat(columnNumber - 1) + "^\n";

          // Add the warning message
          const line = `Line ${lineNumber}`;
          const column = columnNumber > 0 ? `, Column ${columnNumber}` : "";

          output += `${line}${column}: ${warning.message} (warning)\n\n`;
        } else {
          output += `Warning: ${warning.message}\n\n`;
        }
      });
    }

    return output.trim();
  }

  /**
   * Format code snippet around a specific line
   */
  formatCodeSnippet(
    code: string,
    lineNumber: number,
    contextLines: number = 2,
  ): string {
    // Split code into lines
    const lines = code.split("\n");

    // Calculate start and end lines
    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length - 1, lineNumber + contextLines - 1);

    // Extract the snippet
    let snippet = "";

    for (let i = startLine; i <= endLine; i++) {
      const linePrefix = i === lineNumber - 1 ? ">" : " ";
      snippet += `${linePrefix} ${i + 1} | ${lines[i]}\n`;
    }

    return snippet;
  }
}
