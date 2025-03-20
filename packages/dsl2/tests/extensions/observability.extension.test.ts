import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the observability extension module
vi.mock('../../src/extensions/observability.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/observability.extension.js');
  return {
    ...actual,
    setupObservabilityExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupObservabilityExtension, 
  ObservabilityExtensionOptions 
} from '../../src/extensions/observability.extension.js';

describe('Observability Extension', () => {
  let dsl: DSL;
  let observabilityOptions: ObservabilityExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    observabilityOptions = {
      defaultLogLevel: 'info',
      metrics: {
        enabled: true,
        defaultLabels: {
          service: 'test-service'
        }
      },
      tracing: {
        enabled: true,
        samplingRate: 0.1
      }
    };
    
    // Setup extension
    setupObservabilityExtension(dsl, observabilityOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Observability Configuration', () => {
    it('should add observability configuration to system definitions', () => {
      // Define a system component with observability
      const system = dsl.system('MonitoredSystem', {
        description: 'System with comprehensive observability',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        observability: {
          metrics: {
            custom: ['order_processing_time', 'checkout_funnel_conversion'],
            slos: [
              { name: 'order-processing', target: '99.9%', window: '30d' }
            ]
          },
          logging: {
            level: 'info',
            sensitiveFields: ['creditCardNumber', 'password'],
            sampling: { errorRate: 1.0, infoRate: 0.01 }
          },
          tracing: {
            samplingRate: 0.1,
            propagation: 'w3c'
          },
          alerts: [
            { 
              name: 'high-error-rate',
              condition: 'error_rate > 0.05 for 5m',
              channels: ['slack-ops', 'pagerduty-primary']
            }
          ]
        }
      });
      
      // Extension should process and validate the observability configuration
      expect(system.observability).toBeDefined();
      expect(system.observability.metrics.custom).toContain('order_processing_time');
      expect(system.observability.logging.level).toBe('info');
      expect(system.observability.tracing.samplingRate).toBe(0.1);
      expect(system.observability.alerts).toHaveLength(1);
    });
    
    it('should support different logging configurations', () => {
      // Define a system with detailed logging
      const verboseSystem = dsl.system('VerboseSystem', {
        description: 'System with verbose logging',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        observability: {
          logging: {
            level: 'debug',
            sensitiveFields: ['ssn', 'password', 'credit_card'],
            format: 'json',
            destination: 'stdout',
            retention: '90d'
          }
        }
      });
      
      expect(verboseSystem.observability.logging.level).toBe('debug');
      expect(verboseSystem.observability.logging.format).toBe('json');
      
      // Define a system with minimal logging
      const minimalSystem = dsl.system('MinimalSystem', {
        description: 'System with minimal logging',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        observability: {
          logging: {
            level: 'error',
            sampling: { errorRate: 1.0, infoRate: 0.0, debugRate: 0.0 }
          }
        }
      });
      
      expect(minimalSystem.observability.logging.level).toBe('error');
      expect(minimalSystem.observability.logging.sampling.infoRate).toBe(0.0);
    });
  });

  describe('Metrics Collection', () => {
    it('should add metrics capabilities to components', () => {
      // Define a command with instrumentation
      const processOrderCommand = dsl.component('ProcessOrder', {
        type: ComponentType.COMMAND,
        description: 'Process an order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          metrics: {
            counters: [
              { name: 'orders_processed_total', help: 'Total number of processed orders' }
            ],
            histograms: [
              { 
                name: 'order_processing_duration_seconds', 
                help: 'Time taken to process orders',
                buckets: [0.1, 0.5, 1, 2, 5]
              }
            ]
          }
        }
      });
      
      // Extension should add metrics methods to the component
      expect(typeof (processOrderCommand as any).incrementCounter).toBe('function');
      expect(typeof (processOrderCommand as any).observeHistogram).toBe('function');
      
      // Mock metrics implementation
      const incrementCounterMock = vi.fn();
      const observeHistogramMock = vi.fn();
      
      (processOrderCommand as any).incrementCounter = incrementCounterMock;
      (processOrderCommand as any).observeHistogram = observeHistogramMock;
      
      // Mock command implementation
      const processOrderImpl = vi.fn().mockImplementation(async (input, context) => {
        // Implementation would call the metrics methods
        context.metrics.incrementCounter('orders_processed_total', 1, { status: 'success' });
        context.metrics.observeHistogram('order_processing_duration_seconds', 0.45, { order_type: 'standard' });
        
        return { orderId: 'order-123', status: 'processed' };
      });
      
      dsl.implement('ProcessOrder', processOrderImpl);
      
      // Execute command
      (processOrderCommand as any).execute({}, { 
        metrics: { 
          incrementCounter, 
          observeHistogram 
        } 
      });
      
      // Verify metrics were recorded
      function incrementCounter(name: string, value: number, labels: Record<string, string>) {
        incrementCounterMock(name, value, labels);
      }
      
      function observeHistogram(name: string, value: number, labels: Record<string, string>) {
        observeHistogramMock(name, value, labels);
      }
      
      expect(incrementCounterMock).toHaveBeenCalledWith(
        'orders_processed_total', 
        1, 
        { status: 'success' }
      );
      
      expect(observeHistogramMock).toHaveBeenCalledWith(
        'order_processing_duration_seconds',
        0.45,
        { order_type: 'standard' }
      );
    });
    
    it('should automatically track durations for instrumented operations', async () => {
      // Define a command with auto-instrumentation
      const longRunningCommand = dsl.component('LongRunningOperation', {
        type: ComponentType.COMMAND,
        description: 'Long running operation',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          metrics: {
            autoInstrument: true,
            histograms: [
              { 
                name: 'operation_duration_seconds', 
                help: 'Time taken to perform operation'
              }
            ]
          }
        }
      });
      
      // Mock histogram observation
      const observeHistogramMock = vi.fn();
      (longRunningCommand as any).observeHistogram = observeHistogramMock;
      
      // Mock slow implementation
      const mockImplementation = vi.fn().mockImplementation(async () => {
        // Simulate some work taking time
        await new Promise(resolve => setTimeout(resolve, 50));
        return { result: 'done' };
      });
      
      dsl.implement('LongRunningOperation', mockImplementation);
      
      // Execute with auto-instrumentation
      await (longRunningCommand as any).execute({}, {
        metrics: { observeHistogram }
      });
      
      // Should automatically record duration
      function observeHistogram(name: string, value: number, labels: Record<string, string>) {
        observeHistogramMock(name, value, labels);
      }
      
      expect(observeHistogramMock).toHaveBeenCalled();
      expect(observeHistogramMock.mock.calls[0][0]).toBe('operation_duration_seconds');
      // Duration should be measurable
      expect(observeHistogramMock.mock.calls[0][1]).toBeGreaterThan(0);
    });
  });

  describe('Distributed Tracing', () => {
    it('should add tracing capabilities to components', async () => {
      // Define a command with tracing
      const createOrderCommand = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create a new order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          tracing: {
            enabled: true,
            attributes: ['customer.id', 'order.total']
          }
        }
      });
      
      // Mock tracing API
      const startSpanMock = vi.fn().mockImplementation((name, options) => {
        return {
          name,
          attributes: options?.attributes || {},
          end: vi.fn(),
          addEvent: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn()
        };
      });
      
      // Mock implementation with tracing spans
      const createOrderImpl = vi.fn().mockImplementation(async (input, context) => {
        // In actual implementation, would use the tracing API from context
        const span = context.tracing.startSpan('create_order', { 
          attributes: { 
            'customer.id': input.customerId,
            'order.total': input.total
          }
        });
        
        try {
          // Simulate calling another service
          const paymentSpan = context.tracing.startSpan('process_payment', {
            attributes: { 'payment.amount': input.total }
          });
          
          // Add an event to the span
          paymentSpan.addEvent('payment_initiated', { provider: 'stripe' });
          
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
          
          paymentSpan.end();
          
          return { 
            id: 'order-123', 
            status: 'created', 
            customerId: input.customerId,
            total: input.total
          };
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: 'ERROR', message: (error as Error).message });
          throw error;
        } finally {
          span.end();
        }
      });
      
      dsl.implement('CreateOrder', createOrderImpl);
      
      // Execute with tracing context
      const result = await (createOrderCommand as any).execute(
        { customerId: 'cust-123', total: 99.99 },
        { tracing: { startSpan: startSpanMock } }
      );
      
      // Verify tracing was used
      expect(startSpanMock).toHaveBeenCalledTimes(2);
      expect(startSpanMock).toHaveBeenCalledWith('create_order', {
        attributes: { 'customer.id': 'cust-123', 'order.total': 99.99 }
      });
      expect(startSpanMock).toHaveBeenCalledWith('process_payment', {
        attributes: { 'payment.amount': 99.99 }
      });
      
      // Verify result
      expect(result.id).toBe('order-123');
      expect(result.customerId).toBe('cust-123');
    });
    
    it('should propagate trace context across component boundaries', async () => {
      // Define a sequence of components that should maintain trace context
      const validateOrderCommand = dsl.component('ValidateOrder', {
        type: ComponentType.COMMAND,
        description: 'Validate an order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          tracing: { enabled: true }
        }
      });
      
      const processPaymentCommand = dsl.component('ProcessPayment', {
        type: ComponentType.COMMAND,
        description: 'Process payment',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          tracing: { enabled: true }
        }
      });
      
      const createOrderCommand = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          tracing: { enabled: true }
        }
      });
      
      // Mock tracing context carrier
      const traceContext = { 
        traceId: '1234567890abcdef',
        spanId: '0987654321fedcba'
      };
      
      // Mock span creation that captures parent context
      let capturedParentContext: any = null;
      const startSpanMock = vi.fn().mockImplementation((name, options) => {
        capturedParentContext = options?.parent;
        return {
          name,
          context: { ...traceContext, spanId: Math.random().toString(36).substring(2, 10) },
          end: vi.fn()
        };
      });
      
      // Implementations that call the next component
      const validateOrderImpl = vi.fn().mockImplementation(async (input, context) => {
        const span = context.tracing.startSpan('validate_order');
        
        // Call the next component with the current span as parent
        const paymentResult = await (processPaymentCommand as any).execute(
          { orderId: input.orderId, amount: input.total },
          { ...context, tracing: { ...context.tracing, currentSpan: span } }
        );
        
        span.end();
        return { valid: true, paymentResult };
      });
      
      const processPaymentImpl = vi.fn().mockImplementation(async (input, context) => {
        const span = context.tracing.startSpan('process_payment', {
          parent: context.tracing.currentSpan?.context
        });
        
        // Call the next component with the current span as parent
        const orderResult = await (createOrderCommand as any).execute(
          { orderId: input.orderId },
          { ...context, tracing: { ...context.tracing, currentSpan: span } }
        );
        
        span.end();
        return { success: true, transaction: 'txn-123', orderResult };
      });
      
      const createOrderImpl = vi.fn().mockImplementation(async (input, context) => {
        const span = context.tracing.startSpan('create_order', {
          parent: context.tracing.currentSpan?.context
        });
        
        // Final component in the chain
        span.end();
        return { id: input.orderId, status: 'created' };
      });
      
      dsl.implement('ValidateOrder', validateOrderImpl);
      dsl.implement('ProcessPayment', processPaymentImpl);
      dsl.implement('CreateOrder', createOrderImpl);
      
      // Execute the chain with tracing context
      await (validateOrderCommand as any).execute(
        { orderId: 'order-123', total: 99.99 },
        { tracing: { startSpan: startSpanMock } }
      );
      
      // Verify trace propagation
      expect(startSpanMock).toHaveBeenCalledTimes(3);
      // The last call should have parent context from previous span
      expect(capturedParentContext).toBeDefined();
    });
  });

  describe('Structured Logging', () => {
    it('should add logging capabilities to components', () => {
      // Define a component with logging
      const processRefundCommand = dsl.component('ProcessRefund', {
        type: ComponentType.COMMAND,
        description: 'Process a refund',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        observability: {
          logging: {
            level: 'info',
            sensitiveFields: ['paymentDetails.cardNumber'],
            events: [
              { name: 'refund_initiated', level: 'info' },
              { name: 'refund_completed', level: 'info' },
              { name: 'refund_failed', level: 'error' }
            ]
          }
        }
      });
      
      // Mock logger
      const loggerMock = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      
      // Mock implementation that uses logging
      const processRefundImpl = vi.fn().mockImplementation(async (input, context) => {
        const { logger } = context;
        
        logger.info('refund_initiated', { 
          orderId: input.orderId,
          amount: input.amount,
          reason: input.reason,
          // This should be automatically redacted
          paymentDetails: input.paymentDetails
        });
        
        try {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Simulate success
          logger.info('refund_completed', { 
            orderId: input.orderId,
            transactionId: 'refund-123' 
          });
          
          return { 
            refundId: 'refund-123',
            status: 'completed', 
            amount: input.amount 
          };
        } catch (error) {
          logger.error('refund_failed', { 
            orderId: input.orderId,
            error: error.message 
          });
          throw error;
        }
      });
      
      dsl.implement('ProcessRefund', processRefundImpl);
      
      // Execute with logger
      (processRefundCommand as any).execute(
        { 
          orderId: 'order-123', 
          amount: 49.99, 
          reason: 'customer_request',
          paymentDetails: { 
            cardNumber: '4111111111111111',
            expiryDate: '12/25'
          }
        },
        { logger: loggerMock }
      );
      
      // Verify logging occurred with sensitive fields redacted
      expect(loggerMock.info).toHaveBeenCalledTimes(2);
      const firstLogCall = loggerMock.info.mock.calls[0];
      expect(firstLogCall[0]).toBe('refund_initiated');
      
      // Sensitive field should be redacted
      expect(firstLogCall[1].paymentDetails.cardNumber).not.toBe('4111111111111111');
      expect(firstLogCall[1].paymentDetails.cardNumber).toMatch(/^\*+\d{4}$/);
      
      // Non-sensitive fields should be unchanged
      expect(firstLogCall[1].orderId).toBe('order-123');
      expect(firstLogCall[1].amount).toBe(49.99);
      expect(firstLogCall[1].paymentDetails.expiryDate).toBe('12/25');
    });
    
    it('should support contextual logging', async () => {
      // Define a component
      const importDataCommand = dsl.component('ImportData', {
        type: ComponentType.COMMAND,
        description: 'Import data from external source',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' }
      });
      
      // Mock logger with context capabilities
      const loggerWithContextMock = {
        createChildLogger: vi.fn().mockImplementation((context) => {
          return {
            debug: vi.fn(),
            info: vi.fn((message, data) => {
              // Merge context with log data
              const enrichedData = { ...context, ...data };
              logInfoSpy(message, enrichedData);
            }),
            warn: vi.fn(),
            error: vi.fn((message, data) => {
              // Merge context with log data
              const enrichedData = { ...context, ...data };
              logErrorSpy(message, enrichedData);
            })
          };
        })
      };
      
      const logInfoSpy = vi.fn();
      const logErrorSpy = vi.fn();
      
      // Mock implementation that uses contextual logging
      const importDataImpl = vi.fn().mockImplementation(async (input, context) => {
        // Create a child logger with operation context
        const operationLogger = context.logger.createChildLogger({ 
          operationId: 'import-123',
          source: input.source,
          batchSize: input.items.length
        });
        
        let successCount = 0;
        let failureCount = 0;
        
        // Process each item
        for (const item of input.items) {
          try {
            // Log with operation context automatically included
            operationLogger.info('processing_item', { itemId: item.id });
            
            // Simulate processing
            await new Promise(resolve => setTimeout(resolve, 5));
            
            // Simulate success for some items
            if (Math.random() > 0.3) {
              successCount++;
            } else {
              throw new Error('Processing failed');
            }
          } catch (error) {
            failureCount++;
            operationLogger.error('item_processing_failed', { 
              itemId: item.id,
              error: error.message 
            });
          }
        }
        
        return { 
          importId: 'import-123',
          totalItems: input.items.length,
          successCount,
          failureCount
        };
      });
      
      dsl.implement('ImportData', importDataImpl);
      
      // Execute with logger
      await (importDataCommand as any).execute(
        { 
          source: 'database-1',
          items: [
            { id: 'item-1', data: 'value-1' },
            { id: 'item-2', data: 'value-2' },
            { id: 'item-3', data: 'value-3' }
          ]
        },
        { logger: loggerWithContextMock }
      );
      
      // Verify context was included in logs
      expect(loggerWithContextMock.createChildLogger).toHaveBeenCalledWith({
        operationId: 'import-123',
        source: 'database-1',
        batchSize: 3
      });
      
      // Check that logs contain both context and log-specific data
      for (const call of logInfoSpy.mock.calls) {
        expect(call[1]).toHaveProperty('operationId', 'import-123');
        expect(call[1]).toHaveProperty('source', 'database-1');
        expect(call[1]).toHaveProperty('batchSize', 3);
        expect(call[1]).toHaveProperty('itemId');
      }
    });
  });

  describe('Alerting', () => {
    it('should set up alerts based on system configuration', () => {
      // Define a system with alerts
      const alertSystem = dsl.system('AlertSystem', {
        description: 'System with alerts',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        observability: {
          alerts: [
            { 
              name: 'high-error-rate',
              description: 'Alert on high error rate',
              condition: 'rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05',
              severity: 'critical',
              channels: ['slack-alerts', 'pagerduty']
            },
            {
              name: 'high-latency',
              description: 'Alert on high API latency',
              condition: 'histogram_quantile(0.95, http_request_duration_seconds) > 2',
              severity: 'warning',
              channels: ['slack-alerts']
            }
          ]
        }
      });
      
      // Mock alerting setup
      const setupAlertsMock = vi.fn();
      (dsl as any).observabilityExtension = {
        ...(dsl as any).observabilityExtension,
        setupAlerts: setupAlertsMock
      };
      
      // Set up alerts
      (dsl as any).setupAlertsForSystem(alertSystem);
      
      // Verify alerts were set up
      expect(setupAlertsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'high-error-rate',
            severity: 'critical'
          }),
          expect.objectContaining({
            name: 'high-latency',
            severity: 'warning'
          })
        ])
      );
    });
    
    it('should trigger alerts when thresholds are breached', () => {
      // Set up alerting
      const alertTriggerMock = vi.fn();
      (dsl as any).observabilityExtension = {
        ...(dsl as any).observabilityExtension,
        triggerAlert: alertTriggerMock
      };
      
      // Mock a metric that would trigger an alert
      const metricValue = { 
        name: 'http_error_rate', 
        value: 0.06, // Above 5% threshold 
        timestamp: new Date().toISOString() 
      };
      
      // Simulate alert check
      (dsl as any).checkAlertConditions([
        {
          name: 'high-error-rate',
          condition: 'http_error_rate > 0.05',
          severity: 'critical',
          channels: ['slack-alerts']
        }
      ], { http_error_rate: metricValue.value });
      
      // Verify alert was triggered
      expect(alertTriggerMock).toHaveBeenCalledWith({
        name: 'high-error-rate',
        severity: 'critical',
        value: 0.06,
        threshold: 0.05,
        channels: ['slack-alerts']
      });
    });
  });
}); 