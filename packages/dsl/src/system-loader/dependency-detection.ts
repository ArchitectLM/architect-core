/**
 * Dependency Detection
 * 
 * This module provides functions for detecting dependencies between components,
 * including circular dependency detection.
 */

import { ComponentRegistry } from '../component-registry.js';
import { Component } from '../types.js';
import { getComponentDependencies } from './component-dependencies.js';

/**
 * Detect circular dependencies between components
 * @param registry The component registry
 * @param startComponentName The name of the component to start from
 * @returns Array of circular dependency paths
 */
export function detectCircularDependencies(
  registry: ComponentRegistry,
  startComponentName: string
): string[][] {
  const visited = new Set<string>();
  const path: string[] = [];
  const circularPaths: string[][] = [];
  
  // Perform depth-first search to detect cycles
  function dfs(componentName: string): void {
    // If we've already visited this component in the current path, we have a cycle
    if (path.includes(componentName)) {
      // Extract the cycle from the path
      const cycleStartIndex = path.indexOf(componentName);
      const cycle = [...path.slice(cycleStartIndex), componentName];
      circularPaths.push(cycle);
      return;
    }
    
    // If we've already visited this component in another path, skip it
    if (visited.has(componentName)) {
      return;
    }
    
    // Mark as visited and add to current path
    visited.add(componentName);
    path.push(componentName);
    
    // Get the component
    const component = registry.getComponent(componentName);
    if (component) {
      // Get dependencies
      const dependencies = getComponentDependencies(component);
      
      // Recursively check each dependency
      for (const dependency of dependencies) {
        dfs(dependency);
      }
    }
    
    // Remove from current path when backtracking
    path.pop();
  }
  
  // Start DFS from the specified component
  dfs(startComponentName);
  
  return circularPaths;
} 