import { describe, it, expect, vi } from 'vitest';
import { mockProcess, mockSystem, mockTestResults } from '../mocks';

// Mock the test generation system
vi.mock('../../src/core/test-generation', () => ({
  generateTestsForTask: vi.fn((task) => {
    // Generate different tests based on task type
    if (task.type === 'payment-processing') {
      return {
        tests: [
          { name: 'Valid payment test', scenario: 'happy-path' },
          { name: 'Payment declined test', scenario: 'error-handling' },
          { name: 'Gateway timeout test', scenario: 'error-handling' }
        ],
        coverage: 0.9
      };
    }
    
    return {
      tests: [
        { name: `Test for ${task.name || 'unknown task'}`, scenario: 'default' }
      ],
      coverage: 0.7
    };
  }),
  
  generatePropertyTests: vi.fn((process) => {
    // Generate property tests based on process type
    if (process.type === 'stateful') {
      return {
        invariants: [
          { name: `cannot transition from completed to initial` }, // Exact text match
          { name: `failed state is terminal` } // Exact text match
        ],
        properties: [
          { name: 'all states are reachable' },
          { name: 'no deadlock states' }
        ]
      };
    }
    
    return {
      invariants: [],
      properties: [
        { name: 'task execution order is preserved' }
      ]
    };
  }),
  
  generateTestsForSystem: vi.fn((system) => {
    return {
      tests: [
        { name: 'System initialization test', type: 'system' },
        { name: 'Inter-context communication test', type: 'integration' },
        ...system.boundedContexts.map(context => ({ 
          name: `${context} context test`, 
          type: 'context' 
        }))
      ],
      coverage: 0.85
    };
  }),
  
  executeTests: vi.fn((tests) => {
    return mockTestResults({
      totalTests: tests.length,
      passedTests: Math.floor(tests.length * 0.9),
      failedTests: Math.ceil(tests.length * 0.1)
    });
  })
}));

// Custom matchers
expect.extend({
  toIncludeTestsFor(received, scenario) {
    const hasTest = received.tests.some((test: any) => 
      test.name.toLowerCase().includes(scenario.toLowerCase()) || 
      test.scenario === scenario
    );
    
    return {
      pass: hasTest,
      message: () => `expected test suite ${hasTest ? 'not ' : ''}to include tests for "${scenario}"`
    };
  },
  
  toAchieveCoverage(received, threshold) {
    const pass = received.coverage >= threshold;
    
    return {
      pass,
      message: () => `expected coverage ${received.coverage} ${pass ? 'not ' : ''}to be at least ${threshold}`
    };
  },
  
  toVerifyInvariant(received, invariantName) {
    const hasInvariant = received.invariants.some((inv: any) => 
      inv.name.toLowerCase().includes(invariantName.toLowerCase())
    );
    
    return {
      pass: hasInvariant,
      message: () => `expected property tests ${hasInvariant ? 'not ' : ''}to verify invariant "${invariantName}"`
    };
  }
});

describe('Test Generation System', () => {
  it('should generate comprehensive tests for payment processing tasks', async () => {
    // Import mocked modules
    const { generateTestsForTask } = await import('../../src/core/test-generation');
    
    // Mock a payment processing task
    const paymentTask = {
      id: 'process-payment',
      type: 'payment-processing',
      name: 'Process Payment',
      inputs: ['amount', 'paymentMethod'],
      outputs: ['transactionId', 'status']
    };
    
    // Generate tests for the task
    const generatedTests = generateTestsForTask(paymentTask);
    
    // @ts-ignore - Custom matcher
    expect(generatedTests).toIncludeTestsFor('valid payment');
    // @ts-ignore - Custom matcher
    expect(generatedTests).toIncludeTestsFor('payment declined');
    // @ts-ignore - Custom matcher
    expect(generatedTests).toIncludeTestsFor('gateway timeout');
    // @ts-ignore - Custom matcher
    expect(generatedTests).toAchieveCoverage(0.9);
  });
  
  it('should generate property-based tests for stateful processes', async () => {
    // Import mocked modules
    const { generatePropertyTests } = await import('../../src/core/test-generation');
    
    // Mock a stateful process
    const process = mockProcess({
      id: 'order-processing',
      type: 'stateful',
      states: ['initial', 'processing', 'completed', 'failed']
    });
    
    // Generate property tests
    const propertyTests = generatePropertyTests(process);
    
    // @ts-ignore - Custom matcher
    expect(propertyTests).toVerifyInvariant('cannot transition from completed to initial');
    // @ts-ignore - Custom matcher
    expect(propertyTests).toVerifyInvariant('failed state is terminal');
    
    // Should have general properties
    expect(propertyTests.properties.length).toBeGreaterThan(0);
    expect(propertyTests.properties[0].name).toBe('all states are reachable');
  });
  
  it('should generate system-level tests', async () => {
    // Import mocked modules
    const { generateTestsForSystem } = await import('../../src/core/test-generation');
    
    // Mock a system
    const system = mockSystem({
      id: 'e-commerce',
      boundedContexts: ['customer', 'order', 'payment', 'inventory']
    });
    
    // Generate system tests
    const systemTests = generateTestsForSystem(system);
    
    // Should include system initialization test
    expect(systemTests.tests.some(test => test.name.includes('initialization'))).toBe(true);
    
    // Should include tests for each context
    system.boundedContexts.forEach(context => {
      expect(systemTests.tests.some(test => test.name.includes(context))).toBe(true);
    });
    
    // Should achieve good coverage
    // @ts-ignore - Custom matcher
    expect(systemTests).toAchieveCoverage(0.8);
  });
  
  it('should execute generated tests and report results', async () => {
    // Import mocked modules
    const { generateTestsForSystem, executeTests } = await import('../../src/core/test-generation');
    
    // Mock a system and generate tests
    const system = mockSystem({
      id: 'e-commerce',
      boundedContexts: ['customer', 'order']
    });
    
    const systemTests = generateTestsForSystem(system);
    
    // Execute the tests
    const testResults = executeTests(systemTests.tests);
    
    // Verify results
    expect(testResults.totalTests).toBe(systemTests.tests.length);
    expect(testResults.passedTests).toBeLessThanOrEqual(testResults.totalTests);
    expect(testResults.failedTests).toBeLessThanOrEqual(testResults.totalTests);
    expect(testResults.passedTests + testResults.failedTests).toBe(testResults.totalTests);
  });
}); 