import { DSL } from '../core/dsl.js';
import { ComponentDefinition } from '../models/component.js';

export interface PolicyExtensionOptions {
  enableCaching?: boolean;
  evaluationTimeout?: number;
}

export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS'
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
  context?: Record<string, any>;
}

export interface PolicyCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface PolicyRule {
  name: string;
  conditions: PolicyCondition[];
  effect: 'allow' | 'deny';
}

export function setupPolicyExtension(dsl: DSL, options?: PolicyExtensionOptions): void {
  // Implementation will be added later
} 