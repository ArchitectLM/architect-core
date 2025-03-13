/**
 * Test definition module
 */
import { TestDefinition } from '../core/types';

/**
 * Define a test
 * 
 * @param config Test configuration
 * @returns Test definition
 */
export function defineTest(config: TestDefinition): TestDefinition {
  // Validate test configuration
  if (!config.name) {
    throw new Error('Test name is required');
  }
  
  if (!config.steps || config.steps.length === 0) {
    throw new Error('Test must have at least one step');
  }
  
  // Return the validated test definition
  return {
    ...config
  };
} 