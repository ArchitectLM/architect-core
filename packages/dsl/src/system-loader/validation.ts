/**
 * System Validation
 * 
 * This module provides functions for validating system definitions.
 */

import { SystemDefinition } from '../types.js';

/**
 * Validate a system definition
 * @param systemDef The system definition to validate
 * @returns Array of validation errors
 */
export function validateSystem(systemDef: SystemDefinition): string[] {
  const errors: string[] = [];
  
  // Check for required fields
  if (!systemDef.name) {
    errors.push('System name is required');
  }
  
  if (!systemDef.components) {
    errors.push('System components are required');
  }
  
  // Check component references
  if (systemDef.components) {
    // Check schema references
    if (systemDef.components.schemas) {
      for (const schemaRef of systemDef.components.schemas) {
        if (!schemaRef.ref) {
          errors.push(`Schema reference is missing a ref property`);
        }
      }
    }
    
    // Check command references
    if (systemDef.components.commands) {
      for (const commandRef of systemDef.components.commands) {
        if (!commandRef.ref) {
          errors.push(`Command reference is missing a ref property`);
        }
      }
    }
    
    // Check event references
    if (systemDef.components.events) {
      for (const eventRef of systemDef.components.events) {
        if (!eventRef.ref) {
          errors.push(`Event reference is missing a ref property`);
        }
      }
    }
    
    // Check query references
    if (systemDef.components.queries) {
      for (const queryRef of systemDef.components.queries) {
        if (!queryRef.ref) {
          errors.push(`Query reference is missing a ref property`);
        }
      }
    }
    
    // Check workflow references
    if (systemDef.components.workflows) {
      for (const workflowRef of systemDef.components.workflows) {
        if (!workflowRef.ref) {
          errors.push(`Workflow reference is missing a ref property`);
        }
      }
    }
  }
  
  return errors;
} 