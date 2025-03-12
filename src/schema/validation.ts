/**
 * Meta-Framework7: Reactive System Schema Validation
 * 
 * This file defines the Zod validation schema for the reactive system.
 */

import { z } from 'zod';
import type { ReactiveSystem } from './types';

/**
 * Tag schema
 */
export const TagSchema = z.string();

/**
 * Trigger schema
 */
export const TriggerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['event', 'schedule', 'webhook', 'message']),
  description: z.string().optional(),
  tags: z.array(TagSchema).optional()
});

/**
 * Task schema
 */
export const TaskSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(['operation', 'decision', 'transformation', 'notification']),
  description: z.string().optional(),
  input: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional().default(true)
  })).optional(),
  output: z.array(z.object({
    name: z.string(),
    type: z.string()
  })).optional(),
  tags: z.array(TagSchema).optional()
});

/**
 * Process schema
 */
export const ProcessSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['stateful', 'stateless']),
  description: z.string().optional(),
  contextId: z.string().optional(),
  tasks: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  transitions: z.array(z.object({
    from: z.string(),
    to: z.string(),
    on: z.string().optional()
  })).optional(),
  tags: z.array(TagSchema).optional()
});

/**
 * Flow schema
 */
export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(['task', 'process', 'condition']),
    entityId: z.string(),
    next: z.array(z.string()).optional()
  })),
  tags: z.array(TagSchema).optional()
});

/**
 * Policy schema
 */
export const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rules: z.array(z.object({
    id: z.string(),
    condition: z.string(),
    action: z.string()
  })),
  tags: z.array(TagSchema).optional()
});

/**
 * Error handler schema
 */
export const ErrorHandlerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  errorType: z.string(),
  action: z.enum(['retry', 'fallback', 'terminate', 'notify']),
  maxRetries: z.number().optional(),
  fallbackTaskId: z.string().optional(),
  notificationTarget: z.string().optional(),
  tags: z.array(TagSchema).optional()
});

/**
 * Bounded context schema
 */
export const BoundedContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  processes: z.array(z.string()).optional(),
  tasks: z.array(z.string()).optional(),
  tags: z.array(TagSchema).optional()
});

/**
 * Reactive system schema
 */
export const ReactiveSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  boundedContexts: z.record(z.string(), BoundedContextSchema).optional(),
  processes: z.record(z.string(), ProcessSchema).optional(),
  tasks: z.record(z.string(), TaskSchema).optional(),
  triggers: z.record(z.string(), TriggerSchema).optional(),
  flows: z.record(z.string(), FlowSchema).optional(),
  policies: z.record(z.string(), PolicySchema).optional(),
  errorHandlers: z.record(z.string(), ErrorHandlerSchema).optional(),
  tags: z.array(TagSchema).optional()
}).refine(
  (system) => {
    // Ensure all process references are valid
    if (system.processes) {
      for (const process of Object.values(system.processes)) {
        if (process.tasks) {
          for (const taskId of process.tasks) {
            if (!system.tasks || !system.tasks[taskId]) {
              return false;
            }
          }
        }
      }
    }
    
    // Ensure all bounded context references are valid
    if (system.boundedContexts) {
      for (const context of Object.values(system.boundedContexts)) {
        if (context.processes) {
          for (const processId of context.processes) {
            if (!system.processes || !system.processes[processId]) {
              return false;
            }
          }
        }
        
        if (context.tasks) {
          for (const taskId of context.tasks) {
            if (!system.tasks || !system.tasks[taskId]) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  },
  {
    message: 'System contains invalid references to processes or tasks',
    path: ['references']
  }
);

/**
 * Validates a system against the schema
 * @param system System to validate
 * @returns Validation result
 */
export function validateSystem(system: any): boolean {
  const result = ReactiveSystemSchema.safeParse(system);
  return result.success;
}

/**
 * Validates a system against the schema and returns detailed results
 * @param system System to validate
 * @returns Validation result with details
 */
export function validateSystemWithResult(system: any): {
  success: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
} {
  const result = ReactiveSystemSchema.safeParse(system);
  
  if (result.success) {
    return {
      success: true,
      errors: []
    };
  } else {
    return {
      success: false,
      errors: result.error.errors.map(error => ({
        path: error.path.join('.'),
        message: error.message
      }))
    };
  }
}