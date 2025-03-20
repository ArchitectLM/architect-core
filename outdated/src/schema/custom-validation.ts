/**
 * Custom Validation Rule System
 * 
 * This module provides functionality for defining and applying custom validation
 * rules to reactive system entities.
 */

import type { ValidationResult } from './validation';

/**
 * Context for validation rules
 */
export interface ValidationContext {
  domain?: string;
  environment?: string;
  securityLevel?: 'standard' | 'enhanced' | 'maximum';
  [key: string]: any;
}

/**
 * Custom validation rule definition
 */
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  applicableTo: string[]; // Entity types this rule applies to
  validate: (entity: any, context: ValidationContext) => ValidationResult;
}

/**
 * Registry for custom validation rules
 */
export class ValidationRegistry {
  private rules: Map<string, ValidationRule> = new Map();
  
  /**
   * Register a validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }
  
  /**
   * Get a validation rule by ID
   */
  getRule(id: string): ValidationRule | undefined {
    return this.rules.get(id);
  }
  
  /**
   * Find rules applicable to an entity type
   */
  findRulesForEntity(entityType: string): ValidationRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.applicableTo.includes(entityType));
  }
  
  /**
   * Validate an entity with specific rules
   */
  validateWithRules(
    entity: any, 
    ruleIds: string[], 
    context: ValidationContext = {}
  ): ValidationResult {
    const errors: Array<{path: string, message: string}> = [];
    
    for (const ruleId of ruleIds) {
      const rule = this.getRule(ruleId);
      if (rule) {
        const result = rule.validate(entity, context);
        if (!result.success) {
          errors.push(...result.errors.map(error => ({
            path: error.path,
            message: `[${rule.name}] ${error.message}`
          })));
        }
      } else {
        errors.push({
          path: '',
          message: `Validation rule '${ruleId}' not found`
        });
      }
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate an entity with all applicable rules
   */
  validateEntity(
    entity: any, 
    entityType: string, 
    context: ValidationContext = {}
  ): ValidationResult {
    const applicableRules = this.findRulesForEntity(entityType);
    const ruleIds = applicableRules.map(rule => rule.id);
    
    return this.validateWithRules(entity, ruleIds, context);
  }
}

/**
 * Common validation rules for reactive systems
 */
export const commonValidationRules: ValidationRule[] = [
  {
    id: 'core.non-empty-id',
    name: 'Non-Empty ID',
    description: 'Ensures that entities have a non-empty ID',
    applicableTo: ['process', 'task', 'flow', 'boundedContext'],
    validate: (entity, _context) => {
      if (!entity.id || entity.id.trim() === '') {
        return {
          success: false,
          errors: [{
            path: 'id',
            message: 'Entity ID cannot be empty'
          }]
        };
      }
      return { success: true, errors: [] };
    }
  },
  {
    id: 'core.descriptive-name',
    name: 'Descriptive Name',
    description: 'Ensures that entities have a descriptive name (at least 3 characters)',
    applicableTo: ['process', 'task', 'flow', 'boundedContext'],
    validate: (entity, _context) => {
      if (!entity.name || entity.name.trim().length < 3) {
        return {
          success: false,
          errors: [{
            path: 'name',
            message: 'Entity name must be at least 3 characters long'
          }]
        };
      }
      return { success: true, errors: [] };
    }
  },
  {
    id: 'process.stateful-has-states',
    name: 'Stateful Process Has States',
    description: 'Ensures that stateful processes define at least one state',
    applicableTo: ['process'],
    validate: (process, _context) => {
      if (process.type === 'stateful' && (!process.states || process.states.length === 0)) {
        return {
          success: false,
          errors: [{
            path: 'states',
            message: 'Stateful process must define at least one state'
          }]
        };
      }
      return { success: true, errors: [] };
    }
  },
  {
    id: 'task.valid-implementation',
    name: 'Valid Task Implementation',
    description: 'Ensures that tasks have a valid implementation',
    applicableTo: ['task'],
    validate: (task, _context) => {
      const errors: Array<{path: string, message: string}> = [];
      
      if (task.implementation) {
        if (!['function', 'external_service', 'mock'].includes(task.implementation.type)) {
          errors.push({
            path: 'implementation.type',
            message: 'Task implementation type must be one of: function, external_service, mock'
          });
        }
        
        if (task.implementation.type === 'function' && !task.implementation.code) {
          errors.push({
            path: 'implementation.code',
            message: 'Function implementation must include code'
          });
        }
        
        if (task.implementation.type === 'external_service' && 
            (!task.implementation.service || !task.implementation.endpoint)) {
          errors.push({
            path: 'implementation.service',
            message: 'External service implementation must include service and endpoint'
          });
        }
      }
      
      return {
        success: errors.length === 0,
        errors
      };
    }
  }
];

/**
 * Create and initialize a validation registry with common rules
 */
export function createValidationRegistry(): ValidationRegistry {
  const registry = new ValidationRegistry();
  
  // Register common validation rules
  commonValidationRules.forEach(rule => {
    registry.registerRule(rule);
  });
  
  return registry;
} 