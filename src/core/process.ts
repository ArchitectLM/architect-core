/**
 * Process definition module
 */
import { ProcessDefinition } from './types';

/**
 * Define a process
 * 
 * @param config Process configuration
 * @returns Process definition
 */
export function defineProcess(config: ProcessDefinition): ProcessDefinition {
  // Validate process configuration
  if (!config.id) {
    throw new Error('Process ID is required');
  }
  
  if (!config.states || config.states.length === 0) {
    throw new Error('Process must have at least one state');
  }
  
  // Set default initial state if not provided
  const initialState = config.initialState || config.states[0];
  
  // Validate transitions
  if (!config.transitions || config.transitions.length === 0) {
    throw new Error('Process must have at least one transition');
  }
  
  // Return the validated process definition
  return {
    ...config,
    initialState
  };
} 