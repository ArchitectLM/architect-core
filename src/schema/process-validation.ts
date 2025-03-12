import { z } from 'zod';
import { TagSchema } from './validation';

// Schema for transitions in stateful processes
export const TransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  on: z.string(),
  description: z.string().optional(),
  conditions: z.array(z.string()).optional()
});

// Schema for error handlers
export const ErrorHandlerSchema = z.object({
  error: z.string(),
  handler: z.string(),
  description: z.string().optional(),
  retry: z.object({
    maxAttempts: z.number().int().positive(),
    backoffStrategy: z.enum(['fixed', 'exponential', 'linear']),
    interval: z.number().int().positive()
  }).optional()
});

// Schema for process definition
export const ProcessSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextId: z.string(),
  type: z.enum(['stateful', 'stateless']),
  tags: z.array(TagSchema).optional(),
  triggers: z.array(z.object({
    type: z.enum(['user_event', 'system_event', 'schedule', 'api_call']),
    name: z.string(),
    description: z.string().optional(),
    payload: z.array(z.string()).optional(),
    contextProperties: z.array(z.string()).optional()
  })),
  tasks: z.array(z.string()),
  states: z.array(z.string()).optional(),
  transitions: z.array(TransitionSchema).optional(),
  errorHandlers: z.array(ErrorHandlerSchema).optional()
}).refine(
  (data) => {
    // If process is stateful, it must have states and transitions
    if (data.type === 'stateful') {
      return !!data.states && data.states.length > 0;
    }
    return true;
  },
  {
    message: 'Stateful processes must have states',
    path: ['states']
  }
).refine(
  (data) => {
    // If transitions are defined, ensure they reference valid states
    if (data.transitions && data.states) {
      for (const transition of data.transitions) {
        if (!data.states.includes(transition.from) || !data.states.includes(transition.to)) {
          return false;
        }
      }
    }
    return true;
  },
  {
    message: 'Transitions must reference valid states',
    path: ['transitions']
  }
);

// Type for process validation result
export type ProcessValidationResult = {
  valid: boolean;
  errors?: string[];
};

/**
 * Validates a process definition against the schema
 * @param process The process to validate
 * @returns Validation result with errors if any
 */
export function validateProcess(process: unknown): ProcessValidationResult {
  const result = ProcessSchema.safeParse(process);
  
  if (result.success) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    };
  }
} 