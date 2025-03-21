import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../../src/models/component.js';

/**
 * Tests for Policy Application in Actor Systems
 * 
 * These tests cover:
 * - Applying retry policies for error recovery
 * - Testing rate limiting functionality
 * - Verifying circuit breaker behavior on failure cascades
 * - Implementing policy composition and precedence
 */
describe('Actor System Policy Application', () => {
  let dsl: DSL;
  let policyTracker: {
    retries: Record<string, number[]>;
    rateLimit: Record<string, { timestamp: number; allowed: boolean }[]>;
    circuitBreaker: Record<string, { state: 'closed' | 'open' | 'half-open'; failures: number }>;
  };
  
  beforeEach(() => {
    dsl = new DSL();
    policyTracker = {
      retries: {},
      rateLimit: {},
      circuitBreaker: {}
    };
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should apply retry policies correctly for message handlers', async () => {
    // Define actor with retry policy
    dsl.component('RetryActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with retry policy',
      version: '1.0.0',
      policies: {
        retry: {
          unstableOperation: {
            attempts: 3,
            backoff: 'exponential',
            initialDelay: '100ms'
          }
        }
      },
      messageHandlers: {
        unstableOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Mock implementation with failures
    let failureCount = 3; // Will fail the first 3 times
    const retryActorImpl = {
      unstableOperation: async (input: any, context: ActorContext) => {
        const operationId = input.id || 'default';
        
        // Track retries
        if (!policyTracker.retries[operationId]) {
          policyTracker.retries[operationId] = [];
        }
        policyTracker.retries[operationId].push(Date.now());
        
        // Simulate failure for the first few attempts
        if (failureCount > 0) {
          failureCount--;
          throw new Error(`Operation failed, ${failureCount} retries remaining`);
        }
        
        // Success after retries
        return { 
          success: true, 
          retryCount: 3 - failureCount,
          message: 'Operation completed successfully after retries'
        };
      }
    };
    
    // Register implementation
    dsl.implementation('RetryActorImpl', {
      targetComponent: 'RetryActor',
      description: 'Implementation with retry logic',
      version: '1.0.0',
      handlers: retryActorImpl
    });
    
    // Mock retry policy executor
    const executeWithRetry = async (operationFn: Function, policyConfig: any) => {
      const { attempts, backoff, initialDelay } = policyConfig;
      let error: Error | null = null;
      
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await operationFn();
        } catch (err) {
          error = err as Error;
          if (attempt < attempts) {
            // Calculate backoff delay
            const delayMultiplier = backoff === 'exponential' ? Math.pow(2, attempt - 1) : attempt;
            const delayMs = parseInt(initialDelay.replace('ms', '')) * delayMultiplier;
            
            // Wait for the backoff period
            await new Promise(resolve => setTimeout(resolve, delayMs));
            // Advance timers in test
            vi.advanceTimersByTime(delayMs);
          }
        }
      }
      
      // All attempts failed
      throw error;
    };
    
    // Execute operation with retry policy
    const result = await executeWithRetry(
      () => retryActorImpl.unstableOperation({ id: 'test-retry' }, { state: {} }),
      { attempts: 3, backoff: 'exponential', initialDelay: '100ms' }
    );
    
    // Verify results
    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(3);
    
    // Verify retry attempts
    expect(policyTracker.retries['test-retry'].length).toBe(4); // 1 initial + 3 retries
    
    // Verify exponential backoff timing
    const retryTimestamps = policyTracker.retries['test-retry'];
    const delays = [];
    for (let i = 1; i < retryTimestamps.length; i++) {
      delays.push(retryTimestamps[i] - retryTimestamps[i-1]);
    }
    
    // First retry: 100ms, Second: 200ms, Third: 400ms
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeGreaterThanOrEqual(400);
  });
  
  it('should implement rate limiting policies for services', async () => {
    // Define actor with rate limiting policy
    dsl.component('RateLimitedActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with rate limiting',
      version: '1.0.0',
      policies: {
        rateLimiting: {
          'api.*': {
            limit: 3,     // 3 requests
            window: '10s' // per 10 seconds
          }
        }
      },
      messageHandlers: {
        'api.getData': {
          input: { type: 'object' },
          output: { type: 'object' },
          pattern: true
        },
        'api.updateData': {
          input: { type: 'object' },
          output: { type: 'object' },
          pattern: true
        }
      }
    });
    
    // Mock implementation
    const rateLimitedImpl = {
      handleMessage: async (pattern: string, input: any, context: ActorContext) => {
        // Track for rate limiting
        const currentTime = Date.now();
        if (!policyTracker.rateLimit[pattern]) {
          policyTracker.rateLimit[pattern] = [];
        }
        
        // Check if rate limited
        const windowMs = 10 * 1000; // 10 seconds
        const windowStart = currentTime - windowMs;
        const recentRequests = policyTracker.rateLimit[pattern]
          .filter(req => req.timestamp >= windowStart)
          .length;
        
        const allowed = recentRequests < 3; // Limit is 3
        
        // Record this attempt
        policyTracker.rateLimit[pattern].push({
          timestamp: currentTime,
          allowed
        });
        
        if (!allowed) {
          throw new Error(`Rate limit exceeded for ${pattern}`);
        }
        
        // Process based on pattern
        if (pattern === 'api.getData') {
          return { data: 'sample data', timestamp: currentTime };
        } else if (pattern === 'api.updateData') {
          return { updated: true, timestamp: currentTime };
        }
        
        throw new Error(`Unknown pattern: ${pattern}`);
      }
    };
    
    // Register implementation
    dsl.implementation('RateLimitedImpl', {
      targetComponent: 'RateLimitedActor',
      description: 'Rate limited implementation',
      version: '1.0.0',
      handlers: rateLimitedImpl
    });
    
    // Simulate multiple requests in sequence
    const executeRequests = async () => {
      const results = [];
      
      // First burst of requests - should be allowed
      for (let i = 0; i < 3; i++) {
        try {
          const result = await rateLimitedImpl.handleMessage('api.getData', { requestId: i }, { state: {} });
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: (error as Error).message });
        }
      }
      
      // This should be rate limited
      try {
        const result = await rateLimitedImpl.handleMessage('api.getData', { requestId: 3 }, { state: {} });
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
      
      // Advance time beyond the rate limit window
      vi.advanceTimersByTime(11000); // 11 seconds
      
      // This should be allowed again
      try {
        const result = await rateLimitedImpl.handleMessage('api.getData', { requestId: 4 }, { state: {} });
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
      
      return results;
    };
    
    // Execute the test
    const results = await executeRequests();
    
    // Verify results
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(results[2].success).toBe(true);
    expect(results[3].success).toBe(false); // Should be rate limited
    expect(results[3].error).toContain('Rate limit exceeded');
    expect(results[4].success).toBe(true); // Should work after window
    
    // Verify rate limit tracking
    expect(policyTracker.rateLimit['api.getData'].length).toBe(5);
    expect(policyTracker.rateLimit['api.getData'][3].allowed).toBe(false);
  });
  
  it('should apply circuit breaker policy for failing services', async () => {
    // Define actor with circuit breaker policy
    dsl.component('CircuitBreakerActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with circuit breaker',
      version: '1.0.0',
      policies: {
        circuitBreaker: {
          remoteCall: {
            failureThreshold: 3,     // Open after 3 failures
            resetTimeout: '5s'       // Reset after 5 seconds
          }
        }
      },
      messageHandlers: {
        remoteCall: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Mock implementation
    let shouldSucceed = false;
    const remoteServiceImpl = {
      remoteCall: async (input: any, context: ActorContext) => {
        // Get circuit state
        const circuitState = policyTracker.circuitBreaker['remoteCall'] || { 
          state: 'closed', // Initial state
          failures: 0
        };
        
        // If circuit is open, fail fast
        if (circuitState.state === 'open') {
          throw new Error('Circuit is open, fast fail');
        }
        
        // Track for test
        if (!policyTracker.circuitBreaker['remoteCall']) {
          policyTracker.circuitBreaker['remoteCall'] = circuitState;
        }
        
        // Simulate remote call success/failure
        if (!shouldSucceed) {
          // Increment failure count
          circuitState.failures += 1;
          
          // Check if we need to open the circuit
          if (circuitState.failures >= 3) {
            circuitState.state = 'open';
            
            // Schedule timeout to half-open
            setTimeout(() => {
              if (policyTracker.circuitBreaker['remoteCall'].state === 'open') {
                policyTracker.circuitBreaker['remoteCall'].state = 'half-open';
              }
            }, 5000);
          }
          
          throw new Error('Remote service failed');
        }
        
        // Success case
        if (circuitState.state === 'half-open') {
          // Reset on success in half-open state
          circuitState.state = 'closed';
          circuitState.failures = 0;
        }
        
        return { success: true, data: input.data };
      }
    };
    
    // Register implementation
    dsl.implementation('RemoteServiceImpl', {
      targetComponent: 'CircuitBreakerActor',
      description: 'Implementation with circuit breaker',
      version: '1.0.0',
      handlers: remoteServiceImpl
    });
    
    // Helper to execute operations with the circuit breaker
    const executeWithCircuitBreaker = async (operationFn: Function) => {
      const circuitKey = 'remoteCall';
      const circuitState = policyTracker.circuitBreaker[circuitKey] || {
        state: 'closed',
        failures: 0
      };
      
      if (!policyTracker.circuitBreaker[circuitKey]) {
        policyTracker.circuitBreaker[circuitKey] = circuitState;
      }
      
      if (circuitState.state === 'open') {
        throw new Error('Circuit is open, fast fail');
      }
      
      try {
        const result = await operationFn();
        
        if (circuitState.state === 'half-open') {
          circuitState.state = 'closed';
          circuitState.failures = 0;
        }
        
        return result;
      } catch (error) {
        if (circuitState.state === 'closed') {
          circuitState.failures += 1;
          if (circuitState.failures >= 3) {
            circuitState.state = 'open';
            setTimeout(() => {
              if (circuitState.state === 'open') {
                circuitState.state = 'half-open';
              }
            }, 5000);
          }
        }
        throw error;
      }
    };
    
    // Test sequence
    const testCircuitBreaker = async () => {
      const results = [];
      
      // First 3 calls - all should fail but circuit remains closed initially
      for (let i = 0; i < 3; i++) {
        try {
          const result = await executeWithCircuitBreaker(() => 
            remoteServiceImpl.remoteCall({ data: `attempt-${i}` }, { state: {} })
          );
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: (error as Error).message });
        }
      }
      
      // At this point circuit should be open
      try {
        const result = await executeWithCircuitBreaker(() => 
          remoteServiceImpl.remoteCall({ data: 'attempt-after-open' }, { state: {} })
        );
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message, circuitOpen: true });
      }
      
      // Wait for timeout and circuit becomes half-open
      vi.advanceTimersByTime(5500); // 5.5 seconds
      
      // Service still failing, should go back to open
      try {
        const result = await executeWithCircuitBreaker(() => 
          remoteServiceImpl.remoteCall({ data: 'attempt-half-open-fail' }, { state: {} })
        );
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
      
      // Make service successful
      shouldSucceed = true;
      
      // Wait for timeout and try again (half-open)
      vi.advanceTimersByTime(5500); // 5.5 seconds
      
      // Should succeed and reset circuit to closed
      try {
        const result = await executeWithCircuitBreaker(() => 
          remoteServiceImpl.remoteCall({ data: 'attempt-half-open-success' }, { state: {} })
        );
        results.push({ success: true, result, circuitReset: true });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
      
      return results;
    };
    
    // Execute test
    const results = await testCircuitBreaker();
    
    // Verify results
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(false);
    
    // Circuit should be open now
    expect(results[3].success).toBe(false);
    expect(results[3].circuitOpen).toBe(true);
    expect(results[3].error).toContain('Circuit is open');
    
    // After timeout but still failing
    expect(results[4].success).toBe(false);
    
    // After timeout and service recovered
    expect(results[5].success).toBe(true);
    expect(results[5].circuitReset).toBe(true);
    
    // Verify final circuit state
    expect(policyTracker.circuitBreaker['remoteCall'].state).toBe('closed');
    expect(policyTracker.circuitBreaker['remoteCall'].failures).toBe(0);
  });
  
  it('should support policy composition and precedence rules', async () => {
    // Define actors with various policies
    dsl.component('BasePolicyActor', {
      type: ComponentType.ACTOR,
      description: 'Base actor with default policies',
      version: '1.0.0',
      policies: {
        retry: {
          '*': { attempts: 2, backoff: 'linear' }
        },
        timeout: {
          '*': { duration: '5s' }
        }
      },
      messageHandlers: {
        baseOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('OverridePolicyActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that overrides policies',
      version: '1.0.0',
      behaviors: [
        { ref: 'BasePolicyActor' }
      ],
      policies: {
        retry: {
          criticalOperation: { attempts: 5, backoff: 'exponential' }
        },
        timeout: {
          criticalOperation: { duration: '10s' }
        },
        circuitBreaker: {
          criticalOperation: { failureThreshold: 3, resetTimeout: '30s' }
        }
      },
      messageHandlers: {
        criticalOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define system with its own policies
    const system = dsl.system('PolicySystem', {
      description: 'System with policy hierarchy',
      version: '1.0.0',
      policies: {
        retry: {
          'emergency.*': { attempts: 10, backoff: 'none' }
        },
        security: {
          authentication: { required: true }
        }
      },
      components: {
        actors: [
          { ref: 'BasePolicyActor' },
          { ref: 'OverridePolicyActor' }
        ]
      }
    });
    
    // Mock function that merges policies according to precedence rules
    const resolvePolicies = (operation: string, actor: any, system: any) => {
      // Policy resolution order:
      // 1. Operation-specific actor policies
      // 2. Pattern-matched actor policies
      // 3. Operation-specific system policies
      // 4. Pattern-matched system policies
      // 5. Default policies
      
      const result: Record<string, any> = {
        retry: { attempts: 1, backoff: 'none' }, // Default
        timeout: { duration: '1s' },             // Default
        circuitBreaker: undefined,               // No default
        security: { authentication: false }      // Default
      };
      
      // Apply system pattern policies
      if (system.policies) {
        if (system.policies.retry) {
          Object.entries(system.policies.retry).forEach(([pattern, config]) => {
            if (pattern === '*' || (pattern.endsWith('.*') && operation.startsWith(pattern.slice(0, -2)))) {
              result.retry = { ...result.retry, ...config };
            }
          });
        }
        
        if (system.policies.security) {
          result.security = { ...result.security, ...system.policies.security };
        }
      }
      
      // Apply actor wildcard policies
      if (actor.policies) {
        if (actor.policies.retry && actor.policies.retry['*']) {
          result.retry = { ...result.retry, ...actor.policies.retry['*'] };
        }
        
        if (actor.policies.timeout && actor.policies.timeout['*']) {
          result.timeout = { ...result.timeout, ...actor.policies.timeout['*'] };
        }
      }
      
      // Apply actor operation-specific policies (highest precedence)
      if (actor.policies) {
        if (actor.policies.retry && actor.policies.retry[operation]) {
          result.retry = { ...result.retry, ...actor.policies.retry[operation] };
        }
        
        if (actor.policies.timeout && actor.policies.timeout[operation]) {
          result.timeout = { ...result.timeout, ...actor.policies.timeout[operation] };
        }
        
        if (actor.policies.circuitBreaker && actor.policies.circuitBreaker[operation]) {
          result.circuitBreaker = actor.policies.circuitBreaker[operation];
        }
      }
      
      return result;
    };
    
    // Test policy resolution
    const basePolicies = resolvePolicies('baseOperation', 
      dsl.getComponent('BasePolicyActor'), 
      system
    );
    
    const overridePolicies = resolvePolicies('criticalOperation', 
      dsl.getComponent('OverridePolicyActor'), 
      system
    );
    
    const emergencyPolicies = resolvePolicies('emergency.critical', 
      dsl.getComponent('OverridePolicyActor'), 
      system
    );
    
    // Verify base policy resolution
    expect(basePolicies.retry.attempts).toBe(2); // From base actor wildcard
    expect(basePolicies.timeout.duration).toBe('5s'); // From base actor wildcard
    expect(basePolicies.security.authentication).toBe(true); // From system
    
    // Verify override policy resolution
    expect(overridePolicies.retry.attempts).toBe(5); // From override actor specific
    expect(overridePolicies.retry.backoff).toBe('exponential'); // From override actor specific
    expect(overridePolicies.timeout.duration).toBe('10s'); // From override actor specific
    expect(overridePolicies.circuitBreaker).toBeDefined();
    expect(overridePolicies.circuitBreaker.failureThreshold).toBe(3);
    expect(overridePolicies.security.authentication).toBe(true); // From system
    
    // Verify emergency pattern resolution
    expect(emergencyPolicies.retry.attempts).toBe(10); // From system pattern match
    expect(emergencyPolicies.retry.backoff).toBe('none'); // From system pattern match
  });
}); 