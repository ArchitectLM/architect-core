import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { ErrorClassificationExtension } from '../src/extensions/error-classification.js';
import { Event } from '../src/models.js';

// This will be implemented next
import { ErrorRecoveryExtension, RecoveryStrategy } from '../src/extensions/error-recovery.js';

describe('ErrorRecoveryExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let errorClassificationExtension: ErrorClassificationExtension;
  let errorRecoveryExtension: ErrorRecoveryExtension;

  beforeEach(() => {
    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'error.classify',
      description: 'Classifies errors for better handling',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'error.recover',
      description: 'Attempts to recover from errors',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'error.fallback',
      description: 'Provides fallback values when recovery fails',
      handlers: []
    });
    
    // Create the extensions
    errorClassificationExtension = new ErrorClassificationExtension();
    errorRecoveryExtension = new ErrorRecoveryExtension();
    
    // Register the extensions
    extensionSystem.registerExtension(errorClassificationExtension);
    extensionSystem.registerExtension(errorRecoveryExtension);
  });

  describe('GIVEN a network error', () => {
    it('SHOULD attempt to recover using the retry strategy', async () => {
      // Setup a mock recovery strategy
      const retryStrategy: RecoveryStrategy = {
        name: 'retry',
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({ success: true, result: 'recovered data' })
      };
      
      errorRecoveryExtension.registerRecoveryStrategy(retryStrategy);
      
      // Create a network error
      const error = new Error('Connection refused');
      error.name = 'NetworkError';
      
      // WHEN attempting to recover from the error
      const context = {
        error,
        operation: 'fetchData',
        args: ['https://api.example.com/data']
      };
      
      const result = await extensionSystem.triggerExtensionPoint('error.recover', context);
      
      // THEN the retry strategy should be used
      expect(retryStrategy.canRecover).toHaveBeenCalledWith(expect.objectContaining({
        error,
        operation: 'fetchData'
      }));
      
      expect(retryStrategy.recover).toHaveBeenCalledWith(expect.objectContaining({
        error,
        operation: 'fetchData',
        args: ['https://api.example.com/data']
      }));
      
      // AND the recovery should be successful
      expect(result).toEqual({
        success: true,
        result: 'recovered data',
        strategy: 'retry'
      });
    });
    
    it('SHOULD try multiple strategies until one succeeds', async () => {
      // Setup mock recovery strategies
      const failingStrategy: RecoveryStrategy = {
        name: 'cache',
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({ success: false, error: new Error('Cache miss') })
      };
      
      const successStrategy: RecoveryStrategy = {
        name: 'fallback',
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({ success: true, result: 'fallback data' })
      };
      
      errorRecoveryExtension.registerRecoveryStrategy(failingStrategy);
      errorRecoveryExtension.registerRecoveryStrategy(successStrategy);
      
      // Create a network error
      const error = new Error('Connection refused');
      error.name = 'NetworkError';
      
      // WHEN attempting to recover from the error
      const context = {
        error,
        operation: 'fetchData',
        args: ['https://api.example.com/data']
      };
      
      const result = await extensionSystem.triggerExtensionPoint('error.recover', context);
      
      // THEN both strategies should be tried
      expect(failingStrategy.canRecover).toHaveBeenCalled();
      expect(failingStrategy.recover).toHaveBeenCalled();
      expect(successStrategy.canRecover).toHaveBeenCalled();
      expect(successStrategy.recover).toHaveBeenCalled();
      
      // AND the result should come from the successful strategy
      expect(result).toEqual({
        success: true,
        result: 'fallback data',
        strategy: 'fallback'
      });
    });
  });

  describe('GIVEN an unrecoverable error', () => {
    it('SHOULD return a failure result', async () => {
      // Create an unrecoverable error
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      
      // WHEN attempting to recover from the error
      const context = {
        error,
        operation: 'processData',
        args: [{ invalid: 'data' }]
      };
      
      const result = await extensionSystem.triggerExtensionPoint('error.recover', context);
      
      // THEN the result should indicate failure
      expect(result).toEqual({
        success: false,
        error,
        attempted: []
      });
    });
    
    it('SHOULD provide a fallback value when recovery fails', async () => {
      // Setup a fallback handler
      errorRecoveryExtension.registerFallbackHandler('processData', () => ({ defaultValue: true }));
      
      // Create an unrecoverable error
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      
      // WHEN attempting to recover and then falling back
      const recoverContext = {
        error,
        operation: 'processData',
        args: [{ invalid: 'data' }]
      };
      
      const recoverResult = await extensionSystem.triggerExtensionPoint('error.recover', recoverContext);
      
      // AND then requesting a fallback
      const fallbackContext = {
        error,
        operation: 'processData',
        args: [{ invalid: 'data' }],
        recoverResult
      };
      
      const fallbackResult = await extensionSystem.triggerExtensionPoint('error.fallback', fallbackContext);
      
      // THEN a fallback value should be provided
      expect(fallbackResult).toEqual({
        success: true,
        result: { defaultValue: true },
        source: 'fallback'
      });
    });
  });

  describe('GIVEN an error with a specific domain context', () => {
    it('SHOULD use domain-specific recovery strategies', async () => {
      // Setup a domain-specific recovery strategy
      const domainStrategy: RecoveryStrategy = {
        name: 'domainSpecific',
        canRecover: vi.fn().mockImplementation(context => 
          context.domain === 'payment' && context.error.name === 'PaymentError'
        ),
        recover: vi.fn().mockResolvedValue({ 
          success: true, 
          result: { status: 'payment_pending', id: '12345' } 
        })
      };
      
      errorRecoveryExtension.registerRecoveryStrategy(domainStrategy);
      
      // Create a domain-specific error
      const error = new Error('Payment gateway timeout');
      error.name = 'PaymentError';
      
      // WHEN attempting to recover with domain context
      const context = {
        error,
        operation: 'processPayment',
        domain: 'payment',
        args: [{ amount: 100, currency: 'USD' }]
      };
      
      const result = await extensionSystem.triggerExtensionPoint('error.recover', context);
      
      // THEN the domain-specific strategy should be used
      expect(domainStrategy.canRecover).toHaveBeenCalledWith(expect.objectContaining({
        error,
        domain: 'payment'
      }));
      
      expect(result).toEqual({
        success: true,
        result: { status: 'payment_pending', id: '12345' },
        strategy: 'domainSpecific'
      });
    });
  });
}); 