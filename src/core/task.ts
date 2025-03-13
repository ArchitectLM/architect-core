/**
 * Task definition module
 */
import { TaskDefinition } from './types';

/**
 * Define a task with implementation
 * @param config Task configuration
 * @returns Validated task definition
 */
export function defineTask(config: TaskDefinition): TaskDefinition {
  // Validate required fields
  if (!config.id) {
    throw new Error('Task ID is required');
  }
  
  if (!config.implementation) {
    throw new Error('Task implementation is required');
  }
  
  // Return the validated task definition
  return {
    ...config
  };
} 