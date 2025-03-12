/**
 * Visualization System
 * 
 * This module provides functionality for visualizing system definitions
 * and their components.
 */

/**
 * Visualizes a system definition
 */
export function visualizeSystem(system: any) {
  return {
    boundedContexts: ['rendered'],
    processes: ['rendered'],
    flows: ['rendered']
  };
}

/**
 * Generates a graph representation of a system
 */
export function generateSystemGraph(system: any) {
  return {
    nodes: [
      { id: 'system', label: system.name },
      ...(system.boundedContexts || []).map((bc: any) => ({ id: bc, label: bc }))
    ],
    edges: [
      ...(system.boundedContexts || []).map((bc: any) => ({ from: 'system', to: bc }))
    ]
  };
}

/**
 * Generates a process flow diagram
 */
export function generateProcessFlow(process: any) {
  if (process.type === 'stateful' && Array.isArray(process.states)) {
    return {
      nodes: process.states.map((state: string) => ({ id: state, label: state })),
      edges: process.transitions.map((t: any) => ({ from: t.from, to: t.to, label: t.event }))
    };
  }
  
  return {
    nodes: [{ id: 'start', label: 'Start' }, { id: 'end', label: 'End' }],
    edges: [{ from: 'start', to: 'end' }]
  };
}