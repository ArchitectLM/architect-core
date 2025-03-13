/**
 * Process definition module
 */
import { ProcessDefinition, Transition } from './types';

/**
 * Define a process with states and transitions
 * @param config Process configuration
 * @returns Validated process definition
 */
export function defineProcess(config: ProcessDefinition): ProcessDefinition {
  // Validate required fields
  if (!config.id) {
    throw new Error('Process ID is required');
  }
  
  if (!config.states || config.states.length === 0) {
    throw new Error('Process must have at least one state');
  }
  
  if (!config.transitions || config.transitions.length === 0) {
    throw new Error('Process must have at least one transition');
  }
  
  // Check for duplicate states
  const stateSet = new Set<string>();
  for (const state of config.states) {
    if (stateSet.has(state)) {
      throw new Error(`Duplicate state name: ${state}`);
    }
    stateSet.add(state);
  }
  
  // Set default initial state if not provided
  const initialState = config.initialState || config.states[0];
  
  // Validate initial state is in states array
  if (!config.states.includes(initialState)) {
    throw new Error('Initial state must be one of the defined states');
  }
  
  // Create the process config with validated initialState
  const processConfig: ProcessDefinition = {
    ...config,
    initialState
  };
  
  // Validate transitions
  validateTransitions(processConfig.transitions, processConfig.states);
  
  return processConfig;
}

/**
 * Validate transitions against states
 * @param transitions Transitions to validate
 * @param states Valid states
 */
function validateTransitions(transitions: Transition[], states: string[]): void {
  // Track transitions from each state to detect duplicates
  const stateTransitions = new Map<string, Set<string>>();
  
  for (const transition of transitions) {
    // Validate event type
    if (!transition.on) {
      throw new Error('Transition must have an event type');
    }
    
    // Validate target state
    if (!states.includes(transition.to)) {
      throw new Error(`Transition references undefined state: ${transition.to}`);
    }
    
    // Handle array of source states
    const sources = Array.isArray(transition.from) ? transition.from : [transition.from];
    
    // Check for mixing wildcard with specific states
    if (sources.includes('*') && sources.length > 1) {
      throw new Error('Cannot mix wildcard with specific states in transition source');
    }
    
    // Validate source states and check for duplicate transitions
    for (const source of sources) {
      if (source !== '*' && !states.includes(source)) {
        throw new Error(`Transition references undefined state: ${source}`);
      }
      
      // Check for duplicate transitions (same source and event)
      if (!stateTransitions.has(source)) {
        stateTransitions.set(source, new Set());
      }
      
      const events = stateTransitions.get(source)!;
      if (events.has(transition.on)) {
        throw new Error(`Duplicate transition event: ${transition.on} from state: ${source}`);
      }
      
      events.add(transition.on);
    }
  }
} 