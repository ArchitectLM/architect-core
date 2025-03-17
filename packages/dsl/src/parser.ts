import { z } from "zod";
import {
  DSLConfig,
  Schema,
  Function,
  Command,
  Pipeline,
  ExtensionPoint,
  BackoffStrategy,
  RateLimitStrategy,
} from "./models.js";

/**
 * Zod schema for validating metadata
 */
const metadataSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    purpose: z.string().optional(),
    domain: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

/**
 * Zod schema for circuit breaker configuration
 */
const circuitBreakerSchema = z.object({
  failureThreshold: z.number(),
  resetTimeout: z.number(),
  halfOpenSuccessThreshold: z.number().optional(),
});

/**
 * Zod schema for basic retry configuration
 */
const retrySchema = z.object({
  maxAttempts: z.number(),
  backoff: z.enum(["fixed", "exponential", "linear"]),
  initialDelay: z.number().optional(),
  maxDelay: z.number().optional(),
});

/**
 * Zod schema for enhanced retry configuration
 */
const enhancedRetrySchema = z.object({
  maxAttempts: z.number(),
  strategy: z.nativeEnum(BackoffStrategy),
  initialDelay: z.number(),
  maxDelay: z.number(),
  factor: z.number().optional(),
  onRetry: z.string().optional(),
  shouldRetry: z.string().optional(),
});

/**
 * Zod schema for bulkhead configuration
 */
const bulkheadSchema = z.object({
  maxConcurrent: z.number(),
  maxQueue: z.number().optional(),
  timeout: z.number().optional(),
});

/**
 * Zod schema for rate limiter configuration
 */
const rateLimiterSchema = z.object({
  strategy: z.nativeEnum(RateLimitStrategy),
  limit: z.number(),
  window: z.number().optional(),
  refillRate: z.number().optional(),
  refillInterval: z.number().optional(),
});

/**
 * Zod schema for cache configuration
 */
const cacheSchema = z.object({
  ttl: z.number(),
  maxSize: z.number().optional(),
  staleWhileRevalidate: z.boolean().optional(),
});

/**
 * Zod schema for dead letter queue configuration
 */
const deadLetterQueueSchema = z.object({
  maxRetries: z.number().optional(),
  retryDelay: z.number().optional(),
  errorHandler: z.string().optional(),
});

/**
 * Zod schema for resilience configuration
 */
const resilienceSchema = z.object({
  circuitBreaker: circuitBreakerSchema.optional(),
  retry: retrySchema.optional(),
  enhancedRetry: enhancedRetrySchema.optional(),
  bulkhead: bulkheadSchema.optional(),
  rateLimit: rateLimiterSchema.optional(),
  cache: cacheSchema.optional(),
  deadLetterQueue: deadLetterQueueSchema.optional(),
  timeout: z.number().optional(),
});

/**
 * Zod schema for validating the DSL configuration
 */
const dslConfigSchema = z.object({
  meta: metadataSchema,
  schemas: z.record(z.string(), z.any()),
  functions: z.record(
    z.string(),
    z
      .object({
        meta: metadataSchema,
        implementation: z.function().optional(),
      })
      .passthrough(),
  ),
  commands: z.record(
    z.string(),
    z
      .object({
        meta: metadataSchema,
        input: z.string(),
        output: z.string(),
        implementation: z.function().optional(),
        resilience: resilienceSchema.optional(),
      })
      .passthrough(),
  ),
  pipelines: z.record(
    z.string(),
    z
      .object({
        description: z.string().optional(),
        input: z.string(),
        output: z.string(),
        steps: z.array(
          z.object({
            name: z.string(),
            function: z.string(),
            input: z.string().optional(),
            output: z.string().optional(),
            condition: z.string().optional(),
            resilience: resilienceSchema.optional(),
          }),
        ),
        errorHandling: z
          .object({
            fallback: z.string().optional(),
            retryable: z.array(z.string()).optional(),
            maxRetries: z.number().optional(),
            deadLetterQueue: z.string().optional(),
          })
          .optional(),
        resilience: resilienceSchema.optional(),
      })
      .passthrough(),
  ),
  extensionPoints: z.record(
    z.string(),
    z
      .object({
        description: z.string().optional(),
        parameters: z.array(z.string()).optional(),
      })
      .passthrough(),
  ),
  extensions: z
    .record(
      z.string(),
      z
        .object({
          meta: metadataSchema,
          hooks: z.record(
            z.string(),
            z
              .object({
                meta: metadataSchema.optional(),
                implementation: z.function().optional(),
              })
              .passthrough(),
          ),
          configuration: z.record(z.string(), z.any()).optional(),
        })
        .passthrough(),
    )
    .optional(),
});

/**
 * Validates that all referenced schemas exist in the configuration
 */
function validateSchemaReferences(config: any): void {
  // Check command input/output references
  for (const [commandName, command] of Object.entries(config.commands)) {
    const { input, output } = command as { input: string; output: string };

    if (input && !config.schemas[input]) {
      throw new Error(
        `Command "${commandName}" references undefined type "${input}" as input`,
      );
    }

    if (output && !config.schemas[output]) {
      throw new Error(
        `Command "${commandName}" references undefined type "${output}" as output`,
      );
    }
  }

  // Check pipeline input/output references
  for (const [pipelineName, pipeline] of Object.entries(config.pipelines)) {
    const { input, output } = pipeline as { input: string; output: string };

    if (input && !config.schemas[input]) {
      throw new Error(
        `Pipeline "${pipelineName}" references undefined type "${input}" as input`,
      );
    }

    if (output && !config.schemas[output]) {
      throw new Error(
        `Pipeline "${pipelineName}" references undefined type "${output}" as output`,
      );
    }
  }
}

/**
 * Validates that all referenced functions exist in the configuration
 */
function validateFunctionReferences(config: any): void {
  const availableFunctions = new Set([
    ...Object.keys(config.functions || {}),
    ...Object.keys(config.commands || {}),
  ]);

  // Check pipeline step function references
  for (const [pipelineName, pipeline] of Object.entries(config.pipelines)) {
    const { steps, errorHandling } = pipeline as {
      steps: Array<{ function: string }>;
      errorHandling?: { fallback?: string };
    };

    for (const step of steps) {
      if (!availableFunctions.has(step.function)) {
        throw new Error(
          `Pipeline "${pipelineName}" references undefined function "${step.function}"`,
        );
      }
    }

    // Check fallback function reference
    if (
      errorHandling?.fallback &&
      !availableFunctions.has(errorHandling.fallback)
    ) {
      throw new Error(
        `Pipeline "${pipelineName}" references undefined fallback function "${errorHandling.fallback}"`,
      );
    }
  }
}

/**
 * Parses and validates a DSL configuration
 * @param config The raw configuration object
 * @returns A validated DSLConfig object
 */
export function parseDSLConfig(config: any): DSLConfig {
  // Validate the basic structure using Zod
  const validatedConfig = dslConfigSchema.parse(config);

  // Perform additional validation for references
  validateSchemaReferences(validatedConfig);
  validateFunctionReferences(validatedConfig);

  return validatedConfig as DSLConfig;
}
