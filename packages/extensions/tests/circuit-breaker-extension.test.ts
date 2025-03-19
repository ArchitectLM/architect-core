/**
 * Circuit Breaker Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreakerExtension } from '../src/extensions/circuit-breaker.js';
import { Event } from '../src/models.js';

describe('CircuitBreakerExtension', () => {
  let extension: CircuitBreakerExtension;
  let mockOperation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extension = new CircuitBreakerExtension({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenTimeout: 500
    });
    mockOperation = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Circuit States', () => {
    it('should start in CLOSED state', () => {
      expect(extension.getState()).toBe('CLOSED');
    });

    it('should transition to OPEN state after failure threshold', async () => {
      const error = new Error('Operation failed');

      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      expect(extension.getState()).toBe('OPEN');
    });

    it('should transition to HALF_OPEN state after reset timeout', async () => {
      // First fail enough times to open the circuit
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      expect(extension.getState()).toBe('HALF_OPEN');
    });

    it('should transition back to CLOSED state after successful operation in HALF_OPEN', async () => {
      // First fail enough times to open the circuit
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Succeed in HALF_OPEN state
      mockOperation.mockResolvedValueOnce('success');
      await extension.execute(mockOperation);

      expect(extension.getState()).toBe('CLOSED');
    });

    it('should transition back to OPEN state after failed operation in HALF_OPEN', async () => {
      // First fail enough times to open the circuit
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Fail in HALF_OPEN state
      mockOperation.mockRejectedValueOnce(error);
      await expect(extension.execute(mockOperation)).rejects.toThrow(error);

      expect(extension.getState()).toBe('OPEN');
    });
  });

  describe('Operation Execution', () => {
    it('should execute operation in CLOSED state', async () => {
      mockOperation.mockResolvedValueOnce('success');
      const result = await extension.execute(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should reject operation in OPEN state', async () => {
      // First fail enough times to open the circuit
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      // Try to execute in OPEN state
      mockOperation.mockResolvedValueOnce('success');
      await expect(extension.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should execute operation in HALF_OPEN state', async () => {
      // First fail enough times to open the circuit
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Execute in HALF_OPEN state
      mockOperation.mockResolvedValueOnce('success');
      const result = await extension.execute(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(4);
      expect(result).toBe('success');
    });
  });

  describe('Failure Counting', () => {
    it('should reset failure count after successful operation', async () => {
      // First fail twice
      const error = new Error('Operation failed');
      for (let i = 0; i < 2; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      }

      // Then succeed
      mockOperation.mockResolvedValueOnce('success');
      await extension.execute(mockOperation);

      // Fail again
      mockOperation.mockRejectedValueOnce(error);
      await expect(extension.execute(mockOperation)).rejects.toThrow(error);

      expect(extension.getState()).toBe('CLOSED');
    });
  });

  describe('Event Bus Integration', () => {
    it('should publish state change events', async () => {
      const eventBus = {
        publish: vi.fn()
      };

      // First fail enough times to open the circuit
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
        await expect(extension.execute(mockOperation, eventBus)).rejects.toThrow(error);
      }

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0];
      expect(event).toMatchObject({
        type: 'circuit-breaker:state-change',
        payload: {
          previousState: 'CLOSED',
          newState: 'OPEN'
        }
      });

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Succeed in HALF_OPEN state
      mockOperation.mockResolvedValueOnce('success');
      await extension.execute(mockOperation, eventBus);

      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const secondEvent = eventBus.publish.mock.calls[1][0];
      expect(secondEvent).toMatchObject({
        type: 'circuit-breaker:state-change',
        payload: {
          previousState: 'HALF_OPEN',
          newState: 'CLOSED'
        }
      });
    });
  });
}); 