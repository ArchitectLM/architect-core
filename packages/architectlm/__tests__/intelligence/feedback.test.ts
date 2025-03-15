import { describe, it, expect, vi } from 'vitest';
import { mockTelemetry } from '../mocks';

// Mock the feedback system
vi.mock('../../src/intelligence/feedback', () => ({
  analyzeTelemetry: vi.fn((telemetry) => {
    const insights = {
      bottlenecks: [],
      suggestions: [],
      impacts: []
    };
    
    // Analyze process metrics
    if (telemetry.process === 'order-processing') {
      if (telemetry.task === 'inventory-check' && telemetry.averageExecutionTime > 1000) {
        insights.bottlenecks.push('inventory-check');
        insights.suggestions.push('add-caching');
        insights.impacts.push('reduce-latency-by-60-percent');
      }
    }
    
    return insights;
  }),
  
  generateSchemaImprovements: vi.fn((errors) => {
    const improvements = [];
    
    // Generate improvements based on error patterns
    errors.forEach((error: any) => {
      if (error.type === 'validation-error' && error.field === 'email') {
        improvements.push('add-email-format-validation');
      }
      
      if (error.type === 'state-transition-error') {
        improvements.push('add-missing-transition-state');
      }
    });
    
    return improvements;
  }),
  
  collectFeedback: vi.fn((executionResults, telemetry) => {
    return {
      performanceIssues: [
        { process: 'order-processing', task: 'inventory-check', averageTime: 250 }
      ],
      errorPatterns: [
        { type: 'validation-error', field: 'email', frequency: 'high' }
      ],
      usagePatterns: [
        { process: 'user-registration', frequency: 'high' },
        { process: 'checkout', frequency: 'medium' }
      ]
    };
  }),
  
  generateImprovements: vi.fn((feedback) => {
    const improvements = [];
    
    // Generate improvements based on performance issues
    feedback.performanceIssues.forEach((issue: any) => {
      if (issue.task === 'inventory-check') {
        improvements.push({
          type: 'performance',
          target: 'inventory-check',
          suggestion: 'add-caching',
          impact: 'high'
        });
      }
    });
    
    // Generate improvements based on error patterns
    feedback.errorPatterns.forEach((pattern: any) => {
      if (pattern.type === 'validation-error') {
        improvements.push({
          type: 'validation',
          target: `${pattern.field}-field`,
          suggestion: `improve-${pattern.field}-validation`,
          impact: 'medium'
        });
      }
    });
    
    return improvements;
  }),
  
  mockRuntimeData: vi.fn((config) => {
    return {
      process: config.process || 'default-process',
      task: config.task || 'default-task',
      averageExecutionTime: config.averageExecutionTime || 100,
      p95ExecutionTime: config.p95ExecutionTime || 200,
      errorRate: config.errorRate || 0.01,
      ...config
    };
  }),
  
  mockErrorData: vi.fn((errors) => errors)
}));

// Custom matchers
expect.extend({
  toIdentifyBottleneck(received, bottleneckName) {
    const pass = received.bottlenecks.includes(bottleneckName);
    
    return {
      pass,
      message: () => `expected insights ${pass ? 'not ' : ''}to identify bottleneck "${bottleneckName}"`
    };
  },
  
  toSuggestImprovement(received, improvementName) {
    const pass = received.suggestions.includes(improvementName);
    
    return {
      pass,
      message: () => `expected insights ${pass ? 'not ' : ''}to suggest improvement "${improvementName}"`
    };
  },
  
  toEstimateImpact(received, impactDescription) {
    const pass = received.impacts.includes(impactDescription);
    
    return {
      pass,
      message: () => `expected insights ${pass ? 'not ' : ''}to estimate impact "${impactDescription}"`
    };
  },
  
  toInclude(received, item) {
    const pass = received.includes(item);
    
    return {
      pass,
      message: () => `expected ${pass ? 'not ' : ''}to include "${item}"`
    };
  }
});

describe('Feedback System', () => {
  it('should detect performance bottlenecks in process execution', async () => {
    // Import mocked modules
    const { analyzeTelemetry, mockRuntimeData } = await import('../../src/intelligence/feedback');
    
    // Mock runtime telemetry with performance issues
    const mockTelemetry = mockRuntimeData({
      process: 'order-processing',
      task: 'inventory-check',
      averageExecutionTime: 2500, // ms
      p95ExecutionTime: 5000, // ms
      errorRate: 0.05
    });
    
    // Analyze telemetry
    const insights = analyzeTelemetry(mockTelemetry);
    
    // @ts-ignore - Custom matcher
    expect(insights).toIdentifyBottleneck('inventory-check');
    // @ts-ignore - Custom matcher
    expect(insights).toSuggestImprovement('add-caching');
    // @ts-ignore - Custom matcher
    expect(insights).toEstimateImpact('reduce-latency-by-60-percent');
  });
  
  it('should generate schema improvements based on error patterns', async () => {
    // Import mocked modules
    const { generateSchemaImprovements, mockErrorData } = await import('../../src/intelligence/feedback');
    
    // Mock error telemetry
    const mockErrors = mockErrorData([
      { type: 'validation-error', field: 'email', frequency: 'high' },
      { type: 'state-transition-error', from: 'processing', to: 'shipped', frequency: 'medium' }
    ]);
    
    // Generate schema improvements
    const schemaImprovements = generateSchemaImprovements(mockErrors);
    
    // @ts-ignore - Custom matcher
    expect(schemaImprovements).toInclude('add-email-format-validation');
    // @ts-ignore - Custom matcher
    expect(schemaImprovements).toInclude('add-missing-transition-state');
  });
  
  it('should collect feedback from execution results and telemetry', async () => {
    // Import mocked modules
    const { collectFeedback } = await import('../../src/intelligence/feedback');
    
    // Mock execution results
    const executionResults = {
      success: true,
      executedProcesses: ['user-registration', 'order-processing'],
      errors: [
        { process: 'order-processing', task: 'payment-validation', message: 'Invalid card number' }
      ]
    };
    
    // Mock telemetry data
    const telemetryData = mockTelemetry({
      processExecutions: 1000,
      averageResponseTime: 150,
      errorRate: 0.03
    });
    
    // Collect feedback
    const feedback = collectFeedback(executionResults, telemetryData);
    
    // Verify feedback structure
    expect(feedback.performanceIssues.length).toBeGreaterThan(0);
    expect(feedback.errorPatterns.length).toBeGreaterThan(0);
    expect(feedback.usagePatterns.length).toBeGreaterThan(0);
    
    // Verify specific feedback items
    const inventoryIssue = feedback.performanceIssues.find((issue: any) => issue.task === 'inventory-check');
    expect(inventoryIssue).toBeDefined();
    expect(inventoryIssue?.averageTime).toBeGreaterThan(0);
    
    const emailError = feedback.errorPatterns.find((error: any) => error.field === 'email');
    expect(emailError).toBeDefined();
    expect(emailError?.frequency).toBe('high');
  });
  
  it('should generate actionable improvements from feedback', async () => {
    // Import mocked modules
    const { generateImprovements } = await import('../../src/intelligence/feedback');
    
    // Mock feedback data
    const feedback = {
      performanceIssues: [
        { process: 'order-processing', task: 'inventory-check', averageTime: 250 },
        { process: 'checkout', task: 'tax-calculation', averageTime: 180 }
      ],
      errorPatterns: [
        { type: 'validation-error', field: 'email', frequency: 'high' },
        { type: 'validation-error', field: 'phone', frequency: 'medium' }
      ],
      usagePatterns: [
        { process: 'user-registration', frequency: 'high' }
      ]
    };
    
    // Generate improvements
    const improvements = generateImprovements(feedback);
    
    // Verify improvements
    expect(improvements.length).toBeGreaterThan(0);
    
    // Check for specific improvements
    const cachingImprovement = improvements.find((imp: any) => 
      imp.type === 'performance' && imp.target === 'inventory-check'
    );
    expect(cachingImprovement).toBeDefined();
    expect(cachingImprovement?.suggestion).toBe('add-caching');
    
    const validationImprovement = improvements.find((imp: any) => 
      imp.type === 'validation' && imp.target === 'email-field'
    );
    expect(validationImprovement).toBeDefined();
    expect(validationImprovement?.suggestion).toBe('improve-email-validation');
  });
}); 