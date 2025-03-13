/**
 * Process definition module
 */
import { ProcessDefinition, Transition, ProcessState } from './types';

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
  
  // Handle both array and object formats for states
  if (!config.states || (Array.isArray(config.states) && config.states.length === 0) || 
      (!Array.isArray(config.states) && Object.keys(config.states).length === 0)) {
    throw new Error('Process must have at least one state');
  }
  
  // Check if we have transitions in the config or in the states
  const hasConfigTransitions = config.transitions && config.transitions.length > 0;
  const hasStateTransitions = !Array.isArray(config.states) && 
    Object.values(config.states).some(state => 
      state && typeof state === 'object' && state.transitions && Object.keys(state.transitions).length > 0
    );
  
  // Only require transitions if states don't have transitions
  if (!hasConfigTransitions && !hasStateTransitions) {
    throw new Error('Process must have at least one transition');
  }
  
  // Convert states object to array if needed for validation
  let stateNames: string[];
  if (Array.isArray(config.states)) {
    stateNames = config.states;
  } else {
    stateNames = Object.keys(config.states);
  }
  
  // Check for duplicate states
  const stateSet = new Set<string>();
  for (const state of stateNames) {
    if (stateSet.has(state)) {
      throw new Error(`Duplicate state name: ${state}`);
    }
    stateSet.add(state);
  }
  
  // Set default initial state if not provided
  const initialState = config.initialState || stateNames[0];
  
  // Validate initial state is in states array
  if (!stateNames.includes(initialState)) {
    throw new Error('Initial state must be one of the defined states');
  }
  
  // Create the process config with validated initialState
  const processConfig: ProcessDefinition = {
    ...config,
    initialState
  };
  
  // Validate transitions if they exist
  if (hasConfigTransitions) {
    validateTransitions(processConfig.transitions!, stateNames);
  }
  
  return processConfig;
}

/**
 * Validate transitions against available states
 */
function validateTransitions(transitions: Transition[], states: string[]): void {
  // Track transitions by from state and event type to detect duplicates
  const transitionMap = new Map<string, Set<string>>();
  
  for (const transition of transitions) {
    // Validate event type
    if (!transition.on) {
      throw new Error('Transition must have an event type');
    }
    
    // Validate from state
    if (Array.isArray(transition.from)) {
      // Check for mixing wildcard with specific states
      if (transition.from.includes('*') && transition.from.length > 1) {
        throw new Error('Cannot mix wildcard with specific states in transition source');
      }
      
      for (const fromState of transition.from) {
        if (fromState !== '*' && !states.includes(fromState)) {
          throw new Error(`Transition from state "${fromState}" is not defined in the process states`);
        }
        
        // Check for duplicate transitions
        checkDuplicateTransition(transitionMap, fromState, transition.on);
      }
    } else if (transition.from !== '*' && !states.includes(transition.from)) {
      throw new Error(`Transition from state "${transition.from}" is not defined in the process states`);
    } else {
      // Check for duplicate transitions
      checkDuplicateTransition(transitionMap, transition.from, transition.on);
    }
    
    // Validate to state
    if (!states.includes(transition.to)) {
      throw new Error(`Transition references undefined state: ${transition.to}`);
    }
  }
}

/**
 * Check for duplicate transitions from the same state with the same event
 */
function checkDuplicateTransition(
  transitionMap: Map<string, Set<string>>, 
  fromState: string, 
  eventType: string
): void {
  if (!transitionMap.has(fromState)) {
    transitionMap.set(fromState, new Set<string>());
  }
  
  const events = transitionMap.get(fromState)!;
  if (events.has(eventType)) {
    throw new Error(`Duplicate transition event: ${eventType} from state: ${fromState}`);
  }
  
  events.add(eventType);
}

/**
 * Get all possible transitions for a process
 */
export function getProcessTransitions(process: ProcessDefinition): Transition[] {
  const transitions: Transition[] = [...(process.transitions || [])];
  
  // If states is an object with transitions, add those too
  if (!Array.isArray(process.states)) {
    Object.entries(process.states).forEach(([stateName, stateConfig]) => {
      if (stateConfig && typeof stateConfig === 'object' && stateConfig.transitions) {
        Object.entries(stateConfig.transitions).forEach(([eventType, transitionConfig]) => {
          transitions.push({
            from: stateName,
            to: transitionConfig.target,
            on: eventType,
            // Add other properties if needed
          });
        });
      }
    });
  }
  
  return transitions;
} 