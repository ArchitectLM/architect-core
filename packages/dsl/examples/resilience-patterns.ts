/**
 * Example of using resilience patterns in the DSL
 */
import {
  DSLConfigBuilder,
  createFunction,
  createCommand,
  createPipeline,
  createCircuitBreakerConfig,
  createRetryConfig,
  createEnhancedRetryConfig,
  createBulkheadConfig,
  createRateLimiterConfig,
  createCacheConfig,
  createDeadLetterQueueConfig,
  createResilienceConfig,
  BackoffStrategy,
  RateLimitStrategy,
} from "../src/index.js";

// Example function that simulates an API call
async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  return response.json();
}

// Example function that simulates a database query
async function queryDatabase(query: string): Promise<any> {
  // Simulate a database query
  return { results: [{ id: 1, name: "Example" }] };
}

// Example function that simulates a message processing
async function processMessage(message: any): Promise<any> {
  // Simulate message processing
  return { processed: true, message };
}

// Create a DSL configuration with resilience patterns
const dslConfig = new DSLConfigBuilder()
  .withMeta({
    name: "Resilience Patterns Example",
    version: "1.0.0",
    description: "Example of using resilience patterns in the DSL",
  })
  // Define schemas
  .withSchema("ApiResponse", {
    type: "object",
    properties: {
      data: { type: "object" },
      status: { type: "number" },
    },
    required: ["data", "status"],
  })
  .withSchema("DatabaseQuery", {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  })
  .withSchema("Message", {
    type: "object",
    properties: {
      id: { type: "string" },
      payload: { type: "object" },
    },
    required: ["id", "payload"],
  })
  // Define functions
  .withFunction(
    "fetchData",
    createFunction(
      {
        name: "Fetch Data",
        description: "Fetches data from an API",
      },
      fetchData
    )
  )
  .withFunction(
    "queryDatabase",
    createFunction(
      {
        name: "Query Database",
        description: "Executes a database query",
      },
      queryDatabase
    )
  )
  .withFunction(
    "processMessage",
    createFunction(
      {
        name: "Process Message",
        description: "Processes a message",
      },
      processMessage
    )
  )
  // Define commands with resilience patterns
  .withCommand(
    "fetchDataWithRetry",
    {
      meta: {
        name: "Fetch Data with Retry",
        description: "Fetches data from an API with retry",
      },
      input: "string",
      output: "ApiResponse",
      implementation: fetchData,
      resilience: createResilienceConfig({
        retry: createRetryConfig(3, "exponential", 1000, 10000),
      }),
    }
  )
  .withCommand(
    "fetchDataWithEnhancedRetry",
    {
      meta: {
        name: "Fetch Data with Enhanced Retry",
        description: "Fetches data from an API with enhanced retry",
      },
      input: "string",
      output: "ApiResponse",
      implementation: fetchData,
      resilience: createResilienceConfig({
        enhancedRetry: createEnhancedRetryConfig(
          5,
          BackoffStrategy.DECORRELATED_JITTER,
          100,
          30000,
          {
            shouldRetry: "isRetryableError",
            onRetry: "logRetryAttempt",
          }
        ),
      }),
    }
  )
  .withCommand(
    "queryDatabaseWithCircuitBreaker",
    {
      meta: {
        name: "Query Database with Circuit Breaker",
        description: "Executes a database query with circuit breaker",
      },
      input: "DatabaseQuery",
      output: "object",
      implementation: queryDatabase,
      resilience: createResilienceConfig({
        circuitBreaker: createCircuitBreakerConfig(5, 30000, 2),
      }),
    }
  )
  .withCommand(
    "processMessageWithBulkhead",
    {
      meta: {
        name: "Process Message with Bulkhead",
        description: "Processes a message with bulkhead",
      },
      input: "Message",
      output: "object",
      implementation: processMessage,
      resilience: createResilienceConfig({
        bulkhead: createBulkheadConfig(10, 20, 5000),
      }),
    }
  )
  .withCommand(
    "fetchDataWithRateLimit",
    {
      meta: {
        name: "Fetch Data with Rate Limit",
        description: "Fetches data from an API with rate limit",
      },
      input: "string",
      output: "ApiResponse",
      implementation: fetchData,
      resilience: createResilienceConfig({
        rateLimit: createRateLimiterConfig(RateLimitStrategy.TOKEN_BUCKET, 100, {
          refillRate: 10,
          refillInterval: 1000,
        }),
      }),
    }
  )
  .withCommand(
    "queryDatabaseWithCache",
    {
      meta: {
        name: "Query Database with Cache",
        description: "Executes a database query with cache",
      },
      input: "DatabaseQuery",
      output: "object",
      implementation: queryDatabase,
      resilience: createResilienceConfig({
        cache: createCacheConfig(60000, 1000, true),
      }),
    }
  )
  .withCommand(
    "processMessageWithDeadLetterQueue",
    {
      meta: {
        name: "Process Message with Dead Letter Queue",
        description: "Processes a message with dead letter queue",
      },
      input: "Message",
      output: "object",
      implementation: processMessage,
      resilience: createResilienceConfig({
        deadLetterQueue: createDeadLetterQueueConfig(3, 5000, "handleFailedMessage"),
      }),
    }
  )
  // Define a pipeline with combined resilience patterns
  .withPipeline(
    "dataProcessingPipeline",
    {
      description: "Pipeline for processing data with resilience patterns",
      input: "string",
      output: "object",
      steps: [
        {
          name: "fetchData",
          function: "fetchData",
          resilience: createResilienceConfig({
            enhancedRetry: createEnhancedRetryConfig(
              3,
              BackoffStrategy.EXPONENTIAL,
              1000,
              10000
            ),
            circuitBreaker: createCircuitBreakerConfig(5, 30000),
          }),
        },
        {
          name: "processData",
          function: "processMessage",
          resilience: createResilienceConfig({
            bulkhead: createBulkheadConfig(5, 10),
          }),
        },
        {
          name: "storeData",
          function: "queryDatabase",
          resilience: createResilienceConfig({
            cache: createCacheConfig(30000),
            deadLetterQueue: createDeadLetterQueueConfig(3, 5000),
          }),
        },
      ],
      errorHandling: {
        fallback: "handlePipelineError",
        retryable: ["NetworkError", "TimeoutError"],
        maxRetries: 3,
        deadLetterQueue: "failedDataProcessing",
      },
      resilience: createResilienceConfig({
        timeout: 30000,
      }),
    }
  )
  .build();

// Export the DSL configuration
export default dslConfig; 