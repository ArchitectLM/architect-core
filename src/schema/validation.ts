/**
 * Meta-Framework7: Reactive System Schema Validation
 * 
 * This file defines the Zod validation schema for the reactive system.
 */

import { z } from 'zod';
import type { ReactiveSystem } from './types';

// Tag schema
export const TagSchema = z.object({
  key: z.string(),
  value: z.string(),
  scope: z.enum(['system', 'context', 'process', 'task', 'data'])
});

// Trigger schema
export const TriggerSchema = z.object({
  type: z.enum(['user_event', 'api_call', 'system_event', 'schedule']),
  name: z.string(),
  description: z.string().optional(),
  payload: z.array(z.string()).optional(),
  contextProperties: z.array(z.string()).optional(),
  url: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  schedule: z.string().optional(),
}).refine(data => {
  // API calls must have a URL
  if (data.type === 'api_call' && !data.url) {
    return false;
  }
  // Schedules must have a schedule string
  if (data.type === 'schedule' && !data.schedule) {
    return false;
  }
  return true;
}, {
  message: "API calls must have a URL and schedules must have a schedule string"
});

// Task schema
export const TaskSchema = z.object({
  id: z.string(),
  type: z.enum(['operation', 'condition', 'transformation', 'notification', 'external_call', 'state_transition', 'manual']),
  label: z.string().optional(),
  description: z.string().optional(),
  input: z.union([z.string(), z.array(z.string())]).optional(),
  output: z.union([z.string(), z.array(z.string())]).optional(),
  url: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  message: z.string().optional(),
  implementation: z.object({
    type: z.enum(['function', 'external_service', 'mock']),
    code: z.string().optional(),
    service: z.string().optional(),
    endpoint: z.string().optional(),
  }).optional(),
  testHints: z.array(z.string()).optional(),
  processId: z.string().optional(),
  tags: z.array(TagSchema).optional(),
  examples: z.array(z.object({
    description: z.string(),
    input: z.record(z.any()),
    expectedOutput: z.record(z.any()),
    tags: z.array(z.string()).optional(),
  })).optional(),
  errorHandlers: z.array(z.object({
    error: z.string(),
    handler: z.string(),
    description: z.string().optional(),
    retry: z.object({
      maxAttempts: z.number(),
      backoffStrategy: z.enum(['fixed', 'exponential']).optional(),
      interval: z.number().optional(),
    }).optional(),
  })).optional(),
}).refine(data => {
  // External calls must have a URL
  if (data.type === 'external_call' && !data.url) {
    return false;
  }
  // Notifications must have a message
  if (data.type === 'notification' && !data.message) {
    return false;
  }
  return true;
}, {
  message: "External calls must have a URL and notifications must have a message"
});

// State transition schema
export const TransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  on: z.string(),
  description: z.string().optional(),
  actions: z.array(z.string()).optional(),
});

// Error handler schema
export const ErrorHandlerSchema = z.object({
  error: z.string(),
  handler: z.string(),
  description: z.string().optional(),
  retry: z.object({
    maxAttempts: z.number(),
    backoffStrategy: z.enum(['fixed', 'exponential']).optional(),
    interval: z.number().optional(),
  }).optional(),
});

// Process example schema
export const ProcessExampleSchema = z.object({
  description: z.string(),
  initialState: z.string().optional(),
  steps: z.array(z.object({
    trigger: z.string().optional(),
    task: z.string().optional(),
    input: z.record(z.any()).optional(),
    expectedState: z.string().optional(),
  })),
  expectedFinalState: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Process schema
export const ProcessSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextId: z.string(),
  type: z.enum(['stateful', 'stateless']),
  entity: z.string().optional(),
  triggers: z.array(TriggerSchema),
  tasks: z.array(z.string()),
  states: z.array(z.string()).optional(),
  transitions: z.array(TransitionSchema).optional(),
  tags: z.array(TagSchema).optional(),
  examples: z.array(ProcessExampleSchema).optional(),
  metadata: z.record(z.any()).optional(),
  errorHandlers: z.array(ErrorHandlerSchema).optional(),
}).refine(data => {
  // Stateful processes must have states and transitions
  if (data.type === 'stateful' && (!data.states || !data.transitions || data.states.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Stateful processes must have states and transitions"
});

// Bounded context schema
export const BoundedContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  processes: z.array(z.string()),
  responsibilities: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(TagSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

// Flow step schema
export const FlowStepSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['process', 'task', 'decision', 'parallel', 'wait']),
  processId: z.string().optional(),
  taskId: z.string().optional(),
  condition: z.string().optional(),
  branches: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    steps: z.array(z.string()),
  })).optional(),
  timeout: z.number().optional(),
  next: z.union([
    z.string(),
    z.array(z.object({
      condition: z.string(),
      stepId: z.string(),
    }))
  ]).optional(),
});

// Flow schema
export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  trigger: z.string(),
  steps: z.array(FlowStepSchema),
  tags: z.array(TagSchema).optional(),
});

// Policy schema
export const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['access', 'rate-limiting', 'data-retention', 'workflow']),
  condition: z.string(),
  effect: z.enum(['allow', 'deny', 'throttle', 'transform', 'audit']),
  parameters: z.record(z.any()).optional(),
});

// Test schema
export const TestSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  input: z.record(z.any()),
  expected_output: z.record(z.any()),
  mocks: z.array(z.object({
    service: z.string(),
    method: z.string(),
    response: z.any(),
  })).optional(),
});

// The complete reactive system schema
export const ReactiveSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  boundedContexts: z.record(BoundedContextSchema),
  processes: z.record(ProcessSchema),
  tasks: z.record(TaskSchema),
  flows: z.record(FlowSchema).optional(),
  policies: z.record(PolicySchema).optional(),
  tests: z.record(TestSchema).optional(),
  tags: z.array(TagSchema).optional(),
  metadata: z.record(z.any()).optional(),
}).refine(data => {
  // Validate that all process references in bounded contexts exist
  for (const [contextId, context] of Object.entries(data.boundedContexts)) {
    for (const processId of context.processes) {
      if (!data.processes[processId]) {
        return false;
      }
    }
  }
  
  // Validate that all task references in processes exist
  for (const [processId, process] of Object.entries(data.processes)) {
    for (const taskRef of process.tasks) {
      if (typeof taskRef === 'string' && !data.tasks[taskRef]) {
        return false;
      }
    }
    
    // Validate that process contextId references a valid bounded context
    if (!data.boundedContexts[process.contextId]) {
      return false;
    }
  }
  
  return true;
}, {
  message: "Invalid references detected in the system definition"
});

/**
 * Validates a reactive system against the schema
 * @param system The system to validate
 * @returns The validated system
 * @throws If the system is invalid
 */
export function validateReactiveSystem(system: unknown): ReactiveSystem {
  return ReactiveSystemSchema.parse(system) as ReactiveSystem;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  success: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Validates a reactive system and returns a structured result
 * @param system The system to validate
 * @returns A validation result object with success flag and any errors
 */
export function validateSystemWithResult(system: unknown): ValidationResult {
  try {
    ReactiveSystemSchema.parse(system);
    return {
      success: true,
      errors: []
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    
    // Handle other types of errors
    return {
      success: false,
      errors: [{
        path: '',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      }]
    };
  }
}