import { ProcessDefinition, ProcessTransition } from '../../src/models/process-system';

/**
 * Legacy transition type used in tests that uses 'on' instead of 'event'
 */
interface LegacyProcessTransition<TState extends string = string> {
  from: TState;
  to: TState;
  on: string; // Legacy property that should be 'event' in the current model
  guard?: (data: unknown, event: unknown) => boolean;
}

/**
 * Process definition with legacy transitions
 */
export interface LegacyProcessDefinition<TState extends string = string, TData = unknown> {
  id: string; // Legacy property that should be 'type' in the current model
  name: string;
  description: string;
  states: TState[];
  initialState: TState;
  finalStates: TState[];
  transitions: LegacyProcessTransition<TState>[];
  version?: string;
  entryActions?: Partial<Record<TState, (data: TData) => Promise<TData>>>;
  exitActions?: Partial<Record<TState, (data: TData) => Promise<TData>>>;
  metadata?: Record<string, unknown>;
}

/**
 * Convert a process definition with legacy transitions to a standard one
 */
export function convertLegacyProcessDefinition<TState extends string = string, TData = unknown>(
  legacyDefinition: LegacyProcessDefinition<TState, TData>
): ProcessDefinition<TState, TData> {
  // Convert transitions from legacy format to current format
  const standardTransitions: ProcessTransition<TState>[] = legacyDefinition.transitions.map(
    (transition: LegacyProcessTransition<TState>): ProcessTransition<TState> => ({
      from: transition.from,
      to: transition.to,
      event: transition.on, // Map 'on' to 'event'
      guard: transition.guard
    })
  );

  // Return a process definition that follows the current model structure
  return {
    type: legacyDefinition.id, // Map 'id' to 'type'
    name: legacyDefinition.name,
    description: legacyDefinition.description,
    states: legacyDefinition.states,
    transitions: standardTransitions,
    initialState: legacyDefinition.initialState,
    finalStates: legacyDefinition.finalStates,
    version: legacyDefinition.version,
    entryActions: legacyDefinition.entryActions,
    exitActions: legacyDefinition.exitActions,
    metadata: legacyDefinition.metadata
  };
}

/**
 * Helper function to create a process definition with the correct structure
 * even when using legacy 'on' and 'id' properties
 */
export function createProcessDefinition<TState extends string = string, TData = unknown>(
  definition: Partial<LegacyProcessDefinition<TState, TData>> & {
    id: string; // Require id as it's needed to convert to type
    states: TState[];
    initialState: TState;
    transitions: LegacyProcessTransition<TState>[];
  }
): ProcessDefinition<TState, TData> {
  // Fill in any missing fields with defaults
  const fullLegacyDefinition: LegacyProcessDefinition<TState, TData> = {
    id: definition.id,
    name: definition.name || definition.id,
    description: definition.description || `Process definition for ${definition.id}`,
    states: definition.states,
    initialState: definition.initialState,
    finalStates: definition.finalStates || [],
    transitions: definition.transitions,
    version: definition.version,
    entryActions: definition.entryActions,
    exitActions: definition.exitActions,
    metadata: definition.metadata
  };

  return convertLegacyProcessDefinition(fullLegacyDefinition);
} 