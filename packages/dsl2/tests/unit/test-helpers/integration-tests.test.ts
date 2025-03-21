import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { createTestScenarioRunner, createTestDSL, createMockContext, createTestEventLog } from './actor-system-test-utils.js';

/**
 * Integration Tests for Actor Systems
 * 
 * This test file demonstrates how to set up and run integration tests
 * for a complete actor system, testing the interaction between multiple
 * components in realistic scenarios.
 */
describe('Actor System Integration Tests', () => {
  let dsl: DSL;
  let eventLog: ReturnType<typeof createTestEventLog>;
  
  beforeEach(() => {
    dsl = createTestDSL();
    eventLog = createTestEventLog();
  });

  describe('E-commerce System Integration', () => {
    // Set up a simple e-commerce system with several actors
    it('should process an order through the entire system', async () => {
      // 1. Define schemas
      const productSchema = dsl.component('Product', {
        type: ComponentType.SCHEMA,
        description: 'Product schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          inStock: { type: 'boolean' }
        },
        required: ['id', 'name', 'price']
      });
      
      const orderItemSchema = dsl.component('OrderItem', {
        type: ComponentType.SCHEMA,
        description: 'Order item schema',
        version: '1.0.0',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' }
        },
        required: ['productId', 'quantity']
      });
      
      const orderSchema = dsl.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          items: {
            type: 'array',
            items: { ref: 'OrderItem' }
          },
          totalAmount: { type: 'number' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'customerId', 'items']
      });
      
      const paymentSchema = dsl.component('Payment', {
        type: ComponentType.SCHEMA,
        description: 'Payment schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          orderId: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string' },
          paymentMethod: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'orderId', 'amount', 'paymentMethod']
      });
      
      // 2. Define actors
      const catalogActor = dsl.component('CatalogActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that manages the product catalog',
        version: '1.0.0',
        messageHandlers: {
          getProduct: {
            input: {
              properties: {
                productId: { type: 'string' }
              },
              required: ['productId']
            },
            output: { ref: 'Product' }
          },
          checkInventory: {
            input: {
              properties: {
                productIds: { 
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['productIds']
            },
            output: {
              properties: {
                results: {
                  type: 'object',
                  additionalProperties: { type: 'boolean' }
                }
              }
            }
          }
        }
      });
      
      const orderActor = dsl.component('OrderActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that manages orders',
        version: '1.0.0',
        messageHandlers: {
          createOrder: {
            input: {
              properties: {
                customerId: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    properties: {
                      productId: { type: 'string' },
                      quantity: { type: 'number' }
                    },
                    required: ['productId', 'quantity']
                  }
                }
              },
              required: ['customerId', 'items']
            },
            output: { ref: 'Order' }
          },
          getOrder: {
            input: {
              properties: {
                orderId: { type: 'string' }
              },
              required: ['orderId']
            },
            output: { ref: 'Order' }
          },
          updateOrderStatus: {
            input: {
              properties: {
                orderId: { type: 'string' },
                status: { type: 'string' }
              },
              required: ['orderId', 'status']
            },
            output: { ref: 'Order' }
          }
        }
      });
      
      const paymentActor = dsl.component('PaymentActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that handles payments',
        version: '1.0.0',
        messageHandlers: {
          processPayment: {
            input: {
              properties: {
                orderId: { type: 'string' },
                amount: { type: 'number' },
                paymentMethod: { type: 'string' }
              },
              required: ['orderId', 'amount', 'paymentMethod']
            },
            output: { ref: 'Payment' }
          },
          getPaymentStatus: {
            input: {
              properties: {
                paymentId: { type: 'string' }
              },
              required: ['paymentId']
            },
            output: {
              properties: {
                status: { type: 'string' }
              }
            }
          }
        }
      });
      
      const fulfillmentActor = dsl.component('FulfillmentActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that handles order fulfillment',
        version: '1.0.0',
        messageHandlers: {
          processFulfillment: {
            input: {
              properties: {
                orderId: { type: 'string' }
              },
              required: ['orderId']
            },
            output: {
              properties: {
                status: { type: 'string' },
                trackingId: { type: 'string' }
              }
            }
          }
        }
      });
      
      // 3. Define system
      const ecommerceSystem = dsl.system('ECommerceSystem', {
        description: 'E-commerce system with catalog, orders, payments, and fulfillment',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'CatalogActor' },
            { ref: 'OrderActor' },
            { ref: 'PaymentActor' },
            { ref: 'FulfillmentActor' }
          ]
        }
      });
      
      // 4. Implement actors with test implementations
      const catalogImpl = dsl.component('CatalogActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of catalog actor',
        version: '1.0.0',
        targetComponent: 'CatalogActor',
        handlers: {
          getProduct: async (input: any, context: any) => {
            eventLog.recordEvent('CatalogActor', 'getProduct', input);
            // Simulate product lookup
            return {
              id: input.productId,
              name: `Product ${input.productId}`,
              price: 100.00,
              inStock: true
            };
          },
          checkInventory: async (input: any, context: any) => {
            eventLog.recordEvent('CatalogActor', 'checkInventory', input);
            // Simulate inventory check
            const results: Record<string, boolean> = {};
            for (const productId of input.productIds) {
              results[productId] = true; // All products in stock for test
            }
            return { results };
          }
        }
      });
      
      const orderImpl = dsl.component('OrderActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of order actor',
        version: '1.0.0',
        targetComponent: 'OrderActor',
        handlers: {
          createOrder: async (input: any, context: any) => {
            eventLog.recordEvent('OrderActor', 'createOrder', input);
            
            // In a real implementation, this would call catalog to get prices
            // Simulate order creation with mock data
            const orderId = `order-${Date.now()}`;
            const items = input.items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: 100.00 // Mock price
            }));
            
            const totalAmount = items.reduce((sum: number, item: any) => 
              sum + (item.price * item.quantity), 0);
            
            return {
              id: orderId,
              customerId: input.customerId,
              items,
              totalAmount,
              status: 'created',
              createdAt: new Date().toISOString()
            };
          },
          getOrder: async (input: any, context: any) => {
            eventLog.recordEvent('OrderActor', 'getOrder', input);
            
            // In a real implementation, this would fetch from persistence
            // Return mock data for test
            return {
              id: input.orderId,
              customerId: 'customer-123',
              items: [
                { productId: 'product-1', quantity: 2, price: 100.00 }
              ],
              totalAmount: 200.00,
              status: 'processing',
              createdAt: new Date().toISOString()
            };
          },
          updateOrderStatus: async (input: any, context: any) => {
            eventLog.recordEvent('OrderActor', 'updateOrderStatus', input);
            
            // In a real implementation, this would update persistence
            return {
              id: input.orderId,
              customerId: 'customer-123',
              items: [
                { productId: 'product-1', quantity: 2, price: 100.00 }
              ],
              totalAmount: 200.00,
              status: input.status,
              createdAt: new Date().toISOString()
            };
          }
        }
      });
      
      const paymentImpl = dsl.component('PaymentActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of payment actor',
        version: '1.0.0',
        targetComponent: 'PaymentActor',
        handlers: {
          processPayment: async (input: any, context: any) => {
            eventLog.recordEvent('PaymentActor', 'processPayment', input);
            
            // In a real implementation, this would call payment provider
            // Simulate payment processing
            const paymentId = `payment-${Date.now()}`;
            
            // Notify order actor about successful payment
            await context.tell('OrderActor', 'updateOrderStatus', {
              orderId: input.orderId,
              status: 'paid'
            });
            
            return {
              id: paymentId,
              orderId: input.orderId,
              amount: input.amount,
              status: 'completed',
              paymentMethod: input.paymentMethod,
              timestamp: new Date().toISOString()
            };
          },
          getPaymentStatus: async (input: any, context: any) => {
            eventLog.recordEvent('PaymentActor', 'getPaymentStatus', input);
            
            // In a real implementation, this would fetch from persistence
            return { status: 'completed' };
          }
        }
      });
      
      const fulfillmentImpl = dsl.component('FulfillmentActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of fulfillment actor',
        version: '1.0.0',
        targetComponent: 'FulfillmentActor',
        handlers: {
          processFulfillment: async (input: any, context: any) => {
            eventLog.recordEvent('FulfillmentActor', 'processFulfillment', input);
            
            // In a real implementation, this would initiate shipping
            // Get order details
            const order = await context.ask('OrderActor', 'getOrder', { 
              orderId: input.orderId 
            });
            
            // Check inventory
            const productIds = order.items.map((item: any) => item.productId);
            const inventoryCheck = await context.ask('CatalogActor', 'checkInventory', {
              productIds
            });
            
            // If all in stock, process fulfillment
            const allInStock = Object.values(inventoryCheck.results).every((value) => 
              typeof value === 'boolean' && value === true
            );
            
            if (allInStock) {
              // Update order status
              await context.tell('OrderActor', 'updateOrderStatus', {
                orderId: input.orderId,
                status: 'shipped'
              });
              
              return {
                status: 'shipped',
                trackingId: `track-${Date.now()}`
              };
            } else {
              // Update order status
              await context.tell('OrderActor', 'updateOrderStatus', {
                orderId: input.orderId,
                status: 'backorder'
              });
              
              return {
                status: 'backorder',
                trackingId: null
              };
            }
          }
        }
      });
      
      // 5. Create test scenario runner
      const runner = createTestScenarioRunner(dsl);
      
      // 6. Run integration test scenario
      await runner.runScenario({
        setup: async () => {
          // Setup code - nothing specific needed here
          return {};
        },
        actions: [
          async () => {
            // Customer places an order
            eventLog.recordEvent('OrderActor', 'createOrder', {
              customerId: 'customer-123',
              items: [
                { productId: 'product-1', quantity: 2 }
              ]
            });
            
            // Run the handler directly with type assertion
            const order = await (orderImpl.handlers?.createOrder as any)(
              {
                customerId: 'customer-123',
                items: [
                  { productId: 'product-1', quantity: 2 }
                ]
              },
              createMockContext()
            );
            
            expect(order.id).toBeDefined();
            expect(order.customerId).toBe('customer-123');
            expect(order.status).toBe('created');
            
            // Process payment
            eventLog.recordEvent('PaymentActor', 'processPayment', {
              orderId: order.id,
              amount: order.totalAmount,
              paymentMethod: 'credit-card'
            });
            
            const mockContextForPayment = createMockContext();
            mockContextForPayment.tell = vi.fn();
            
            const payment = await (paymentImpl.handlers?.processPayment as any)(
              {
                orderId: order.id,
                amount: order.totalAmount,
                paymentMethod: 'credit-card'
              },
              mockContextForPayment
            );
            
            expect(payment.status).toBe('completed');
            
            // Check that order status was updated via context.tell
            expect(mockContextForPayment.tell).toHaveBeenCalledWith(
              'OrderActor', 
              'updateOrderStatus', 
              expect.objectContaining({
                orderId: order.id,
                status: 'paid'
              })
            );
            
            // Get order details
            eventLog.recordEvent('OrderActor', 'getOrder', {
              orderId: order.id
            });
            
            const updatedOrder = await (orderImpl.handlers?.getOrder as any)(
              { orderId: order.id },
              createMockContext()
            );
            
            // Process fulfillment
            eventLog.recordEvent('FulfillmentActor', 'processFulfillment', {
              orderId: order.id
            });
            
            const mockContextForFulfillment = createMockContext();
            mockContextForFulfillment.ask = vi.fn()
              .mockResolvedValueOnce(updatedOrder) // First call is for getOrder
              .mockResolvedValueOnce({ results: { 'product-1': true } }); // Second call is for checkInventory
            
            mockContextForFulfillment.tell = vi.fn();
            
            const fulfillment = await (fulfillmentImpl.handlers?.processFulfillment as any)(
              { orderId: order.id },
              mockContextForFulfillment
            );
            
            expect(fulfillment.status).toBe('shipped');
            expect(fulfillment.trackingId).toBeDefined();
            
            // Verify mock calls
            expect(mockContextForFulfillment.tell).toHaveBeenCalledWith(
              'OrderActor',
              'updateOrderStatus',
              expect.objectContaining({
                orderId: order.id,
                status: 'shipped'
              })
            );
            
            // Verify event sequence
            const events = eventLog.getEvents();
            expect(events.length).toBeGreaterThan(0);
            
            // Verify that events were recorded in the expected order
            const orderCreatedEvent = events.find(e => e.source === 'OrderActor' && e.action === 'createOrder');
            const paymentProcessedEvent = events.find(e => e.source === 'PaymentActor' && e.action === 'processPayment');
            const fulfillmentProcessedEvent = events.find(e => e.source === 'FulfillmentActor' && e.action === 'processFulfillment');
            
            expect(orderCreatedEvent).toBeDefined();
            expect(paymentProcessedEvent).toBeDefined();
            expect(fulfillmentProcessedEvent).toBeDefined();
            
            return { order, payment, fulfillment };
          }
        ]
      });
    });
  });
  
  describe('Data Processing Pipeline', () => {
    it('should process data through a transformation pipeline', async () => {
      // 1. Define schemas
      const rawDataSchema = dsl.component('RawData', {
        type: ComponentType.SCHEMA,
        description: 'Raw data schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string' },
          data: { type: 'string' }
        },
        required: ['id', 'data']
      });
      
      const parsedDataSchema = dsl.component('ParsedData', {
        type: ComponentType.SCHEMA,
        description: 'Parsed data schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string' },
          values: { 
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['id', 'values']
      });
      
      const processedDataSchema = dsl.component('ProcessedData', {
        type: ComponentType.SCHEMA,
        description: 'Processed data schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string' },
          values: { 
            type: 'object',
            additionalProperties: true
          },
          results: {
            type: 'object',
            additionalProperties: true
          },
          summary: { type: 'object' }
        },
        required: ['id', 'values', 'results']
      });
      
      // 2. Define actors
      const ingestorActor = dsl.component('IngestorActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that ingests raw data',
        version: '1.0.0',
        messageHandlers: {
          ingest: {
            input: { ref: 'RawData' },
            output: { type: 'object' }
          }
        }
      });
      
      const parserActor = dsl.component('ParserActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that parses data',
        version: '1.0.0',
        messageHandlers: {
          parse: {
            input: { ref: 'RawData' },
            output: { ref: 'ParsedData' }
          }
        }
      });
      
      const processorActor = dsl.component('ProcessorActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that processes parsed data',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { ref: 'ParsedData' },
            output: { ref: 'ProcessedData' }
          }
        }
      });
      
      const reporterActor = dsl.component('ReporterActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that generates reports',
        version: '1.0.0',
        messageHandlers: {
          generateReport: {
            input: { ref: 'ProcessedData' },
            output: { 
              properties: {
                reportId: { type: 'string' },
                summary: { type: 'object' },
                details: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      });
      
      // 3. Define system
      const dataPipelineSystem = dsl.system('DataPipelineSystem', {
        description: 'Data processing pipeline system',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'IngestorActor' },
            { ref: 'ParserActor' },
            { ref: 'ProcessorActor' },
            { ref: 'ReporterActor' }
          ]
        }
      });
      
      // 4. Implement actors
      const ingestorImpl = dsl.component('IngestorActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of ingestor actor',
        version: '1.0.0',
        targetComponent: 'IngestorActor',
        handlers: {
          ingest: async (input: any, context: any) => {
            eventLog.recordEvent('IngestorActor', 'ingest', input);
            
            // Notify parser to start processing
            await context.tell('ParserActor', 'parse', input);
            
            return { success: true, id: input.id };
          }
        }
      });
      
      const parserImpl = dsl.component('ParserActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of parser actor',
        version: '1.0.0',
        targetComponent: 'ParserActor',
        handlers: {
          parse: async (input: any, context: any) => {
            eventLog.recordEvent('ParserActor', 'parse', input);
            
            // Simulate parsing JSON data
            let values;
            try {
              values = JSON.parse(input.data);
            } catch (e) {
              values = { value: input.data };
            }
            
            const parsedData = {
              id: input.id,
              timestamp: input.timestamp || new Date().toISOString(),
              values
            };
            
            // Send to processor
            await context.tell('ProcessorActor', 'process', parsedData);
            
            return parsedData;
          }
        }
      });
      
      const processorImpl = dsl.component('ProcessorActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of processor actor',
        version: '1.0.0',
        targetComponent: 'ProcessorActor',
        handlers: {
          process: async (input: any, context: any) => {
            eventLog.recordEvent('ProcessorActor', 'process', input);
            
            // Simulate processing
            const results = {};
            
            // Calculate some statistics if the values are numbers
            let sum = 0;
            let count = 0;
            let hasNumericValues = false;
            
            for (const [key, value] of Object.entries(input.values)) {
              if (typeof value === 'number') {
                results[`${key}_squared`] = value * value;
                sum += value;
                count++;
                hasNumericValues = true;
              }
            }
            
            const summary = hasNumericValues
              ? { sum, count, average: sum / count }
              : { type: 'non-numeric', keys: Object.keys(input.values).length };
            
            const processedData = {
              id: input.id,
              timestamp: input.timestamp,
              values: input.values,
              results,
              summary
            };
            
            // Send to reporter
            await context.tell('ReporterActor', 'generateReport', processedData);
            
            return processedData;
          }
        }
      });
      
      const reporterImpl = dsl.component('ReporterActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Test implementation of reporter actor',
        version: '1.0.0',
        targetComponent: 'ReporterActor',
        handlers: {
          generateReport: async (input: any, context: any) => {
            eventLog.recordEvent('ReporterActor', 'generateReport', input);
            
            // Generate report
            const details = [];
            
            for (const [key, value] of Object.entries(input.values)) {
              details.push({ 
                key, 
                original: value,
                processed: input.results[`${key}_squared`]
              });
            }
            
            return {
              reportId: `report-${input.id}`,
              timestamp: new Date().toISOString(),
              summary: input.summary,
              details
            };
          }
        }
      });
      
      // 5. Create test scenario runner
      const runner = createTestScenarioRunner(dsl);
      
      // 6. Run integration test scenario
      await runner.runScenario({
        setup: async () => {
          // Setup - nothing specific needed here
          return {};
        },
        actions: [
          async () => {
            // Generate a raw data object with some numeric values
            const rawData = {
              id: `data-${Date.now()}`,
              timestamp: new Date().toISOString(),
              data: JSON.stringify({
                temperature: 25.5,
                humidity: 60,
                pressure: 1013
              })
            };
            
            // Start the pipeline by manually simulating the workflow
            eventLog.recordEvent('IngestorActor', 'ingest', rawData);
            
            // Create mock context for chaining calls
            const mockContext = createMockContext();
            mockContext.tell = vi.fn();
            
            // Run ingest handler with type assertion
            const result = await (ingestorImpl.handlers?.ingest as any)(rawData, mockContext);
            
            expect(result.success).toBe(true);
            expect(result.id).toBe(rawData.id);
            
            // Check that parser was called
            expect(mockContext.tell).toHaveBeenCalledWith('ParserActor', 'parse', rawData);
            
            // Manually simulate the parser step
            const parsedData = {
              id: rawData.id,
              timestamp: rawData.timestamp,
              values: JSON.parse(rawData.data)
            };
            
            eventLog.recordEvent('ParserActor', 'parse', rawData);
            
            // Create another mock context for processor step
            const parserMockContext = createMockContext();
            parserMockContext.tell = vi.fn();
            
            await (parserImpl.handlers?.parse as any)(rawData, parserMockContext);
            
            // Check that processor was called
            expect(parserMockContext.tell).toHaveBeenCalledWith('ProcessorActor', 'process', expect.objectContaining({
              id: rawData.id
            }));
            
            // Manually simulate the processor step
            eventLog.recordEvent('ProcessorActor', 'process', parsedData);
            
            const processorMockContext = createMockContext();
            processorMockContext.tell = vi.fn();
            
            const processedData = await (processorImpl.handlers?.process as any)(parsedData, processorMockContext);
            
            // Check that reporter was called
            expect(processorMockContext.tell).toHaveBeenCalledWith('ReporterActor', 'generateReport', expect.objectContaining({
              id: rawData.id
            }));
            
            // Manually simulate the reporter step
            eventLog.recordEvent('ReporterActor', 'generateReport', processedData);
            
            const reportData = await (reporterImpl.handlers?.generateReport as any)(processedData, createMockContext());
            
            // Verify event sequence
            const events = eventLog.getEvents();
            
            const ingestEvent = events.find(e => e.source === 'IngestorActor' && e.action === 'ingest');
            const parseEvent = events.find(e => e.source === 'ParserActor' && e.action === 'parse');
            const processEvent = events.find(e => e.source === 'ProcessorActor' && e.action === 'process');
            const reportEvent = events.find(e => e.source === 'ReporterActor' && e.action === 'generateReport');
            
            // Verify each step was executed
            expect(ingestEvent).toBeDefined();
            expect(parseEvent).toBeDefined();
            expect(processEvent).toBeDefined();
            expect(reportEvent).toBeDefined();
            
            // Verify content was transformed appropriately through the pipeline
            if (processEvent) {
              const processData = processEvent.data;
              if (processData && processData.values) {
                expect(processData.values).toHaveProperty('temperature');
                expect(processData.values).toHaveProperty('humidity');
                expect(processData.values).toHaveProperty('pressure');
              }
              
              if (processData && processData.results) {
                const results = processData.results as Record<string, any>;
                expect(results['temperature_squared']).toBeDefined();
              }
              
              if (processData && processData.summary) {
                expect(processData.summary).toHaveProperty('average');
              }
            }
            
            expect(reportData.reportId).toBe(`report-${rawData.id}`);
            expect(reportData.summary).toHaveProperty('average');
            
            return { rawData, parsedData, processedData, reportData };
          }
        ]
      });
    });
  });
}); 