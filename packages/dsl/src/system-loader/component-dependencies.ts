/**
 * Component Dependencies
 * 
 * This module provides functions for extracting dependencies from components.
 */

import { Component, ComponentType } from '../types.js';

/**
 * Get dependencies for a component
 * @param component The component to get dependencies for
 * @returns Array of component names that this component depends on
 */
export function getComponentDependencies(component: Component): string[] {
  const dependencies: string[] = [];
  
  // Extract dependencies based on component type
  switch (component.type) {
    case ComponentType.SCHEMA:
      // Schemas can reference other schemas
      if (component.extends) {
        dependencies.push(component.extends);
      }
      break;
      
    case ComponentType.COMMAND:
      // Commands can reference schemas
      if (component.input && component.input.ref) {
        dependencies.push(component.input.ref);
      }
      if (component.output && component.output.ref) {
        dependencies.push(component.output.ref);
      }
      // Add plugin dependencies
      if (component.plugins) {
        Object.values(component.plugins).forEach(plugin => {
          if (plugin.ref) {
            dependencies.push(plugin.ref);
          }
        });
      }
      break;
      
    case ComponentType.EVENT:
      // Events can reference schemas
      if (component.payload && component.payload.ref) {
        dependencies.push(component.payload.ref);
      }
      break;
      
    case ComponentType.QUERY:
      // Queries can reference schemas
      if (component.input && component.input.ref) {
        dependencies.push(component.input.ref);
      }
      if (component.output && component.output.ref) {
        dependencies.push(component.output.ref);
      }
      break;
      
    case ComponentType.WORKFLOW:
      // Workflows can reference commands
      if (component.steps) {
        for (const step of component.steps) {
          if (step.command) {
            dependencies.push(step.command);
          }
          if (step.next) {
            dependencies.push(step.next);
          }
          if (step.onFailure) {
            dependencies.push(step.onFailure);
          }
        }
      }
      break;
  }
  
  // Add related components
  if (component.relatedComponents) {
    for (const related of component.relatedComponents) {
      if (related.ref) {
        dependencies.push(related.ref);
      }
    }
  }
  
  // Remove duplicates and filter out empty strings
  return [...new Set(dependencies)].filter(Boolean);
} 