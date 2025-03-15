/**
 * Utility functions for the CLI
 */

/**
 * Formats a message for display in the CLI
 */
export function formatMessage(message: string): string {
  return `[ArchitectLM] ${message}`;
}

/**
 * Validates a DSL file path
 */
export function validateDslPath(path: string): boolean {
  return path.endsWith('.ts') || path.endsWith('.js');
}

/**
 * Gets the current timestamp
 */
export function getTimestamp(): string {
  return new Date().toISOString();
} 