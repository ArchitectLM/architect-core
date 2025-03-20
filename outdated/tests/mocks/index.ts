/**
 * Mock utilities for testing Meta-Framework7
 * 
 * This file provides mock implementations of various system components
 * for use in tests.
 */

/**
 * Creates a mock system definition
 */
export function mockSystem(config: any = {}) {
  return {
    id: config.id || 'mock-system',
    name: config.name || 'Mock System',
    description: config.description || 'A mock system for testing',
    version: config.version || '0.1.0',
    boundedContexts: config.boundedContexts || ['default-context'],
    ...config
  };
}

/**
 * Creates a mock LLM service
 */
export function mockLLM(config: any = {}) {
  return {
    responses: config.responses || {},
    defaultResponse: config.defaultResponse || { type: 'default', content: 'Default response' },
    errorRate: config.errorRate || 0,
    
    async generateResponse(prompt: string) {
      if (Math.random() < this.errorRate) {
        throw new Error('LLM service unavailable');
      }
      
      const matchingPrompt = Object.keys(this.responses)
        .find(key => prompt.includes(key));
      
      return matchingPrompt 
        ? this.responses[matchingPrompt]
        : this.defaultResponse;
    }
  };
}

/**
 * Creates a mock runtime environment
 */
export function mockRuntime(config: any = {}) {
  return {
    supportedEvents: config.supportedEvents || ['user_event', 'system_event'],
    supportedTasks: config.supportedTasks || ['default-task'],
    ...config
  };
}

/**
 * Creates mock telemetry data
 */
export function mockTelemetry(config: any = {}) {
  return {
    processExecutions: config.processExecutions || 100,
    taskExecutions: config.taskExecutions || 500,
    averageResponseTime: config.averageResponseTime || 100,
    errorRate: config.errorRate || 0.01,
    ...config
  };
}

/**
 * Creates a mock pattern
 */
export function mockPattern(config: any = {}) {
  return {
    id: config.id || 'mock-pattern',
    name: config.name || 'Mock Pattern',
    description: config.description || 'A mock pattern for testing',
    version: config.version || '0.1.0',
    ...config
  };
}

/**
 * Creates mock test results
 */
export function mockTestResults(config: any = {}) {
  return {
    totalTests: config.totalTests || 10,
    passedTests: config.passedTests || 8,
    failedTests: config.failedTests || 2,
    coverage: config.coverage || 0.8,
    ...config
  };
}

/**
 * Creates a mock process
 */
export function mockProcess(config: any = {}) {
  return {
    id: config.id || 'mock-process',
    name: config.name || 'Mock Process',
    type: config.type || 'stateless',
    tasks: config.tasks || ['task-1', 'task-2'],
    states: config.type === 'stateful' ? (config.states || ['initial', 'completed']) : undefined,
    ...config
  };
} 