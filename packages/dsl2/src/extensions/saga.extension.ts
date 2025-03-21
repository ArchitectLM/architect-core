import { DSL } from '../core/dsl.js';
import { ComponentDefinition } from '../models/component.js';

export interface SagaExtensionOptions {
  enableTransactionLogging?: boolean;
  defaultCompensationStrategy?: CompensationStrategy;
}

export enum CompensationStrategy {
  BACKWARD = 'BACKWARD',
  FORWARD = 'FORWARD',
  CUSTOM = 'CUSTOM'
}

export interface SagaInstance {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING';
  steps: SagaStep[];
}

export interface SagaStep {
  name: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  compensationAction?: string;
}

export function setupSagaExtension(dsl: DSL, options?: SagaExtensionOptions): void {
  // Implementation will be added later
} 