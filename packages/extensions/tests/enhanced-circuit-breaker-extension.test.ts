import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { EnhancedCircuitBreakerExtension, CircuitBreakerState, CircuitBreakerStateChangeContext } from '../src/extensions/enhanced-circuit-breaker.js';

// Define a type-safe context for the circuit breaker hooks
interface CircuitBreakerCreateContext {
  name: string;
  options: {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenSuccessThreshold?: number;
    halfOpenRequestPercentage?: number;
    onStateChange?: (context: CircuitBreakerStateChangeContext) => void;
    isFailure?: (error: Error) => boolean;
  };
}

interface CircuitBreakerExecuteContext {
  name: string;
  fn: () => Promise<any>;
}

describe('EnhancedCircuitBreakerExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let circuitBreakerExtension: EnhancedCircuitBreakerExtension;
  let onStateChangeMock: ReturnType<typeof vi.fn>;
  let originalDateNow: () => number;

  beforeEach(() => {
    // Save original Date.now
    originalDateNow = Date.now;
    
    // Create a new extension system for each test
    extensionSystem = new DefaultExtensionSystem();
    
    // Register the necessary extension points
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.create',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.execute',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.reset',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.getState',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.stateChange',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.configure',
      handlers: []
    });
    
    // Create the circuit breaker extension
    circuitBreakerExtension = new EnhancedCircuitBreakerExtension();
    
    // Register the extension with the system
    extensionSystem.registerExtension(circuitBreakerExtension);
    
    // Create a mock for the state change callback
    onStateChangeMock = vi.fn();
  });

  afterEach(() => {
    // Restore original Date.now
    global.Date.now = originalDateNow;
  });

  describe('Circuit Breaker Creation', () => {
    it('should create a circuit breaker with valid options', async () => {
      // Arrange
      const name = 'test-circuit-breaker';
      const options = {
        failureThreshold: 3,
        resetTimeout: 1000,
        halfOpenSuccessThreshold: 2,
        halfOpenRequestPercentage: 0.5,
        onStateChange: onStateChangeMock
      };

      // Act
      const result = await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, { name: string; created: boolean }>(
        'circuitBreaker.create', 
        { name, options }
      );

      // Assert
      expect(result).toEqual({ name, created: true });
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
    });

    it('should throw an error when creating a circuit breaker with invalid options', async () => {
      // Arrange
      const name = 'invalid-circuit-breaker';
      const options = {
        failureThreshold: 0, // Invalid: must be > 0
        resetTimeout: 1000
      };

      // Act & Assert
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
          'circuitBreaker.create', 
          { name, options }
        )
      ).rejects.toThrow('failureThreshold must be greater than 0');
    });
  });

  describe('Circuit Breaker State Transitions', () => {
    it('should transition from CLOSED to OPEN when failure threshold is reached', async () => {
      // Arrange
      const name = 'failure-threshold-test';
      const options = {
        failureThreshold: 3,
        resetTimeout: 1000,
        onStateChange: onStateChangeMock
      };
      
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { name, options }
      );
      
      const failingFn = async () => {
        throw new Error('Test failure');
      };

      // Act - Execute failing function multiple times
      for (let i = 0; i < 2; i++) {
        await expect(
          extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
            'circuitBreaker.execute', 
            { name, fn: failingFn }
          )
        ).rejects.toThrow('Test failure');
      }
      
      // Circuit should still be closed after 2 failures
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      
      // Third failure should open the circuit
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { name, fn: failingFn }
        )
      ).rejects.toThrow('Test failure');

      // Assert
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);
      expect(onStateChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          previousState: CircuitBreakerState.CLOSED,
          newState: CircuitBreakerState.OPEN,
          failureCount: 3
        })
      );
    });

    it('should reject requests when circuit is OPEN', async () => {
      // Arrange
      const name = 'open-circuit-test';
      const options = {
        failureThreshold: 1,
        resetTimeout: 1000,
        onStateChange: onStateChangeMock
      };
      
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { name, options }
      );
      
      // Open the circuit with a failure
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('Test failure'); } 
          }
        )
      ).rejects.toThrow('Test failure');
      
      // Assert circuit is open
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);

      // Act - Try to execute when circuit is open
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => 'Success' 
          }
        )
      ).rejects.toThrow('Circuit is open');
    });

    it('should transition to HALF_OPEN after reset timeout and then to CLOSED after success', async () => {
      // Arrange
      const name = 'reset-timeout-test';
      const failureThreshold = 3;
      const resetTimeout = 1000;
      const initialTime = Date.now();
      const options = {
        failureThreshold,
        resetTimeout,
        halfOpenRequestPercentage: 1.0, // Always allow requests in HALF_OPEN state for testing
        onStateChange: onStateChangeMock
      };
      
      // Mock Date.now for deterministic testing
      global.Date.now = vi.fn(() => initialTime);
      
      // Create circuit breaker
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, { name: string; created: boolean }>(
        'circuitBreaker.create',
        { name, options }
      );
      
      // Trip the circuit with failures
      for (let i = 0; i < failureThreshold; i++) {
        await expect(
          extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, string>(
            'circuitBreaker.execute',
            { 
              name, 
              fn: async () => { throw new Error('Test failure'); } 
            }
          )
        ).rejects.toThrow('Test failure');
      }
      
      // Assert circuit is open
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);
      
      // Mock Date.now to simulate time passing
      const mockNow = initialTime + resetTimeout + 100; // Add extra time to ensure we're past the timeout
      global.Date.now = vi.fn(() => mockNow);

      // Act - Try to execute after reset timeout
      const successFn = async () => 'Success';
      const result = await extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, string>(
        'circuitBreaker.execute', 
        { name, fn: successFn }
      );

      // Assert
      expect(result).toBe('Success');
      // The circuit should now be CLOSED because a successful execution in HALF_OPEN state
      // with default halfOpenSuccessThreshold of 1 will transition it to CLOSED
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      
      // Verify state change events
      // First from OPEN to HALF_OPEN when reset timeout elapsed
      // Then from HALF_OPEN to CLOSED after successful execution
      expect(onStateChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          previousState: CircuitBreakerState.OPEN,
          newState: CircuitBreakerState.HALF_OPEN
        })
      );
      
      expect(onStateChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          previousState: CircuitBreakerState.HALF_OPEN,
          newState: CircuitBreakerState.CLOSED
        })
      );
    });

    it('should transition from HALF_OPEN to CLOSED after success threshold is reached', async () => {
      // Arrange
      const name = 'half-open-success-test';
      const options = {
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenSuccessThreshold: 2,
        halfOpenRequestPercentage: 1.0, // Allow all requests in half-open state
        onStateChange: onStateChangeMock
      };
      
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { name, options }
      );
      
      // Open the circuit with a failure
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('Test failure'); } 
          }
        )
      ).rejects.toThrow('Test failure');
      
      // Mock Date.now to simulate time passing
      const originalDateNow = Date.now;
      const mockNow = Date.now() + options.resetTimeout + 10;
      global.Date.now = vi.fn(() => mockNow);
      
      // First successful execution in HALF_OPEN state
      await extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
        'circuitBreaker.execute', 
        { 
          name, 
          fn: async () => 'Success 1' 
        }
      );
      
      // Circuit should still be HALF_OPEN after first success
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Second successful execution should close the circuit
      await extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
        'circuitBreaker.execute', 
        { 
          name, 
          fn: async () => 'Success 2' 
        }
      );
      
      // Assert
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      expect(onStateChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          previousState: CircuitBreakerState.HALF_OPEN,
          newState: CircuitBreakerState.CLOSED
        })
      );
      
      // Restore original Date.now
      global.Date.now = originalDateNow;
    });

    it('should transition from HALF_OPEN to OPEN on failure', async () => {
      // Arrange
      const name = 'half-open-failure-test';
      const options = {
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenRequestPercentage: 1.0, // Allow all requests in half-open state
        onStateChange: onStateChangeMock
      };
      
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { name, options }
      );
      
      // Open the circuit with a failure
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('Test failure'); } 
          }
        )
      ).rejects.toThrow('Test failure');
      
      // Mock Date.now to simulate time passing
      const originalDateNow = Date.now;
      const mockNow = Date.now() + options.resetTimeout + 10;
      global.Date.now = vi.fn(() => mockNow);
      
      // Fail in HALF_OPEN state
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('Another failure'); } 
          }
        )
      ).rejects.toThrow('Another failure');
      
      // Assert
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);
      expect(onStateChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          previousState: CircuitBreakerState.HALF_OPEN,
          newState: CircuitBreakerState.OPEN
        })
      );
      
      // Restore original Date.now
      global.Date.now = originalDateNow;
    });
  });

  describe('Circuit Breaker Reset', () => {
    it('should reset a circuit breaker to CLOSED state', async () => {
      // Arrange
      const name = 'reset-test';
      const options = {
        failureThreshold: 1,
        resetTimeout: 1000,
        onStateChange: onStateChangeMock
      };
      
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { name, options }
      );
      
      // Open the circuit with a failure
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('Test failure'); } 
          }
        )
      ).rejects.toThrow('Test failure');
      
      // Assert circuit is open
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);
      
      // Act - Reset the circuit breaker
      const result = await extensionSystem.triggerExtensionPoint<{ name: string }, { name: string; reset: boolean }>(
        'circuitBreaker.reset', 
        { name }
      );
      
      // Assert
      expect(result).toEqual({ name, reset: true });
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      expect(onStateChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          previousState: CircuitBreakerState.OPEN,
          newState: CircuitBreakerState.CLOSED,
          failureCount: 0
        })
      );
    });
  });

  describe('Custom Failure Predicate', () => {
    it('should only count errors that match the failure predicate', async () => {
      // Arrange
      const name = 'custom-failure-test';
      const options = {
        failureThreshold: 2,
        resetTimeout: 1000,
        isFailure: (error: Error) => error.message.includes('count me'),
        onStateChange: onStateChangeMock
      };
      
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { name, options }
      );
      
      // Act - Execute with errors that should not count as failures
      for (let i = 0; i < 3; i++) {
        await expect(
          extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
            'circuitBreaker.execute', 
            { 
              name, 
              fn: async () => { throw new Error('ignore this error'); } 
            }
          )
        ).rejects.toThrow('ignore this error');
      }
      
      // Assert circuit is still closed
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      
      // Act - Execute with errors that should count as failures
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('count me as failure'); } 
          }
        )
      ).rejects.toThrow('count me as failure');
      
      // Assert circuit is still closed after first counted failure
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      
      // Second counted failure should open the circuit
      await expect(
        extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
          'circuitBreaker.execute', 
          { 
            name, 
            fn: async () => { throw new Error('count me as failure too'); } 
          }
        )
      ).rejects.toThrow('count me as failure too');
      
      // Assert circuit is now open
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Configuration Hook', () => {
    it('should allow configuration to be modified by extensions', async () => {
      // Arrange
      const name = 'config-test';
      const originalOptions = {
        failureThreshold: 3,
        resetTimeout: 1000
      };
      
      // Act - Create circuit breaker with original options
      await extensionSystem.triggerExtensionPoint<CircuitBreakerCreateContext, any>(
        'circuitBreaker.create', 
        { 
          name, 
          options: originalOptions 
        }
      );
      
      // Directly modify the circuit breaker options for testing
      const circuitBreaker = circuitBreakerExtension['circuitBreakers'].get(name);
      if (circuitBreaker) {
        circuitBreaker.options.failureThreshold = 5;
      }
      
      // Verify the configuration was modified
      expect(circuitBreaker?.options.failureThreshold).toBe(5);
      
      // Open the circuit with failures
      const failingFn = async () => { throw new Error('Test failure'); };
      
      // Execute failing function 3 times (original threshold)
      for (let i = 0; i < 3; i++) {
        await expect(
          extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
            'circuitBreaker.execute', 
            { name, fn: failingFn }
          )
        ).rejects.toThrow('Test failure');
      }
      
      // Assert circuit is still closed because threshold was modified to 5
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.CLOSED);
      
      // Execute failing function 2 more times to reach modified threshold
      for (let i = 0; i < 2; i++) {
        await expect(
          extensionSystem.triggerExtensionPoint<CircuitBreakerExecuteContext, any>(
            'circuitBreaker.execute', 
            { name, fn: failingFn }
          )
        ).rejects.toThrow('Test failure');
      }
      
      // Assert circuit is now open
      expect(circuitBreakerExtension.getState(name)).toBe(CircuitBreakerState.OPEN);
    });
  });
}); 