/**
 * Task definition module
 */
import { TaskDefinition } from './types';

/**
 * Define a task
 * 
 * @param config Task configuration
 * @returns Task definition
 */
export function defineTask(config: TaskDefinition): TaskDefinition {
  // Validate task configuration
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