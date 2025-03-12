/**
 * Cross-Entity Validation System
 * 
 * This module provides functionality for validating relationships and dependencies
 * between different entities in a reactive system.
 */

import type { Process, ReactiveSystem } from './types';
import { ValidationResult } from './validation';

// Add dependency type to Process for this file
interface ProcessWithDependencies extends Process {
  dependencies?: string[];
}

/**
 * Validates process flow including state transitions
 */
export function validateProcessFlow(process: Process): ValidationResult {
  const errors: Array<{path: string, message: string}> = [];
  
  // Skip validation for stateless processes
  if (process.type !== 'stateful') {
    return { success: true, errors: [] };
  }
  
  // Validate state transitions
  if (process.transitions) {
    const states = new Set(process.states || []);
    
    // Check that all states referenced in transitions exist
    process.transitions.forEach(transition => {
      if (!states.has(transition.from)) {
        errors.push({
          path: `transitions.${transition.from}->${transition.to}`,
          message: `Source state '${transition.from}' does not exist in process states`
        });
      }
      
      if (!states.has(transition.to)) {
        errors.push({
          path: `transitions.${transition.from}->${transition.to}`,
          message: `Target state '${transition.to}' does not exist in process states`
        });
      }
    });
    
    // Check for unreachable states
    if (process.states && process.states.length > 0) {
      const reachableStates = new Set<string>();
      
      // Assume the first state is the initial state
      const initialState = process.states[0];
      reachableStates.add(initialState);
      
      // Find all states reachable from the initial state
      let newStatesFound = true;
      while (newStatesFound) {
        newStatesFound = false;
        
        process.transitions.forEach(transition => {
          if (reachableStates.has(transition.from) && !reachableStates.has(transition.to)) {
            reachableStates.add(transition.to);
            newStatesFound = true;
          }
        });
      }
      
      // Check for unreachable states
      process.states.forEach(state => {
        if (!reachableStates.has(state)) {
          errors.push({
            path: `states.${state}`,
            message: `State '${state}' is unreachable from initial state '${initialState}'`
          });
        }
      });
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Detects circular dependencies between processes
 */
export function detectCircularDependencies(system: ReactiveSystem): ValidationResult {
  const errors: Array<{path: string, message: string}> = [];
  const processIds = Object.keys(system.processes || {});
  
  // Build dependency graph
  const dependencyGraph: Record<string, string[]> = {};
  
  processIds.forEach(processId => {
    const process = system.processes?.[processId] as ProcessWithDependencies;
    if (!process) return;
    
    // Extract dependencies (this is a simplified example - in a real system,
    // you would need to extract dependencies based on your specific data model)
    const dependencies = process.dependencies || [];
    dependencyGraph[processId] = dependencies;
  });
  
  // Check for circular dependencies using DFS
  processIds.forEach(processId => {
    const visited = new Set<string>();
    const path: string[] = [];
    
    const hasCycle = detectCycle(processId, visited, path);
    if (hasCycle) {
      errors.push({
        path: `processes.${processId}`,
        message: `Circular dependency detected: ${path.join(' -> ')}`
      });
    }
  });
  
  function detectCycle(node: string, visited: Set<string>, path: string[]): boolean {
    if (path.includes(node)) {
      path.push(node); // Complete the cycle in the path
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    path.push(node);
    
    const dependencies = dependencyGraph[node] || [];
    for (const dependency of dependencies) {
      if (detectCycle(dependency, visited, [...path])) {
        return true;
      }
    }
    
    return false;
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Validates entity relationships across the system
 */
export function validateEntityRelationships(system: ReactiveSystem): ValidationResult {
  const errors: Array<{path: string, message: string}> = [];
  
  // Validate that all process tasks exist in the system
  Object.entries(system.processes || {}).forEach(([processId, process]) => {
    process.tasks.forEach(taskId => {
      if (!system.tasks?.[taskId]) {
        errors.push({
          path: `processes.${processId}.tasks`,
          message: `Task ${taskId} referenced in process ${processId} does not exist`
        });
      }
    });
  });
  
  // Validate that all bounded contexts referenced by processes exist
  Object.entries(system.processes || {}).forEach(([processId, process]) => {
    if (process.contextId && !system.boundedContexts?.[process.contextId]) {
      errors.push({
        path: `processes.${processId}.contextId`,
        message: `Bounded context ${process.contextId} referenced in process ${processId} does not exist`
      });
    }
  });
  
  // Validate flow references
  Object.entries(system.flows || {}).forEach(([flowId, flow]) => {
    // Validate process references in flow steps
    flow.steps.forEach((step, index) => {
      if (step.processId && !system.processes?.[step.processId]) {
        errors.push({
          path: `flows.${flowId}.steps[${index}].processId`,
          message: `Process ${step.processId} referenced in flow ${flowId} does not exist`
        });
      }
      
      if (step.taskId && !system.tasks?.[step.taskId]) {
        errors.push({
          path: `flows.${flowId}.steps[${index}].taskId`,
          message: `Task ${step.taskId} referenced in flow ${flowId} does not exist`
        });
      }
    });
  });
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Performs comprehensive cross-entity validation on a system
 */
export function validateSystemRelationships(system: ReactiveSystem): ValidationResult {
  const errors: Array<{path: string, message: string}> = [];
  
  // Validate process flows
  Object.entries(system.processes || {}).forEach(([processId, process]) => {
    const flowResult = validateProcessFlow(process);
    if (!flowResult.success) {
      flowResult.errors.forEach((error: {path: string, message: string}) => {
        errors.push({
          path: `processes.${processId}.${error.path}`,
          message: error.message
        });
      });
    }
  });
  
  // Detect circular dependencies
  const circularResult = detectCircularDependencies(system);
  if (!circularResult.success) {
    errors.push(...circularResult.errors);
  }
  
  // Validate entity relationships
  const relationshipResult = validateEntityRelationships(system);
  if (!relationshipResult.success) {
    errors.push(...relationshipResult.errors);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
} 