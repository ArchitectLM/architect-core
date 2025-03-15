/**
 * Reactive System DSL Example - Inventory Management System
 * 
 * This example demonstrates how to use the Reactive System DSL to create
 * an inventory management system with processes for handling stock levels,
 * order processing, and supplier management.
 */

import { ReactiveSystem } from '../src/core/dsl/reactive-system';
import { createAssembler } from '../src/core/dsl/assembler';
import { TaskImplementationFn, TestCase } from '../src/core/dsl/types';

// -----------------------------------------------------------------------------
// Define the Inventory Management System
// -----------------------------------------------------------------------------

// Create the system
const inventorySystem = ReactiveSystem.define('inventory-system')
  .withName('Inventory Management System')
  .withDescription('A system for managing inventory, orders, and suppliers')
  .withMetadata({
    version: '1.0.0',
    author: 'Example Corp',
    tags: ['inventory', 'orders', 'suppliers']
  });

// -----------------------------------------------------------------------------
// Define Tasks
// -----------------------------------------------------------------------------

// Task: Check Stock Levels
inventorySystem
  .withTask('check-stock-levels')
  .withName('Check Stock Levels')
  .withDescription('Check the stock levels of products and identify low stock items')
  .implementation(async (input: { threshold: number }, context: { products: any[] }) => {
    const lowStockItems = context.products.filter(product => product.quantity <= input.threshold);
    return {
      lowStockItems,
      count: lowStockItems.length
    };
  })
  .test('unit', (task) => [
    {
      name: 'Identify low stock items',
      setup: () => ({
        input: { threshold: 10 },
        context: {
          products: [
            { id: 'p1', name: 'Product 1', quantity: 5 },
            { id: 'p2', name: 'Product 2', quantity: 15 },
            { id: 'p3', name: 'Product 3', quantity: 8 },
            { id: 'p4', name: 'Product 4', quantity: 20 }
          ]
        }
      }),
      execute: async (setup) => task(setup.input, setup.context),
      verify: (result, setup) => {
        if (result.count !== 2) {
          throw new Error(`Expected 2 low stock items, got ${result.count}`);
        }
        
        if (!result.lowStockItems.find((item: any) => item.id === 'p1')) {
          throw new Error('Expected Product 1 to be in low stock items');
        }
        
        if (!result.lowStockItems.find((item: any) => item.id === 'p3')) {
          throw new Error('Expected Product 3 to be in low stock items');
        }
      }
    }
  ])
  .build();

// Task: Create Purchase Order
inventorySystem
  .withTask('create-purchase-order')
  .withName('Create Purchase Order')
  .withDescription('Create a purchase order for low stock items')
  .implementation(async (input: { lowStockItems: any[] }, context: { suppliers: any[] }) => {
    // Group items by supplier
    const itemsBySupplier = input.lowStockItems.reduce((acc, item) => {
      const supplier = context.suppliers.find(s => s.products.includes(item.id));
      if (supplier) {
        if (!acc[supplier.id]) {
          acc[supplier.id] = {
            supplier,
            items: []
          };
        }
        acc[supplier.id].items.push(item);
      }
      return acc;
    }, {} as Record<string, { supplier: any, items: any[] }>);
    
    // Create purchase orders
    const purchaseOrders = Object.values(itemsBySupplier).map((supplierData: any) => ({
      id: `po-${Date.now()}-${supplierData.supplier.id}`,
      supplierId: supplierData.supplier.id,
      supplierName: supplierData.supplier.name,
      items: supplierData.items.map((item: any) => ({
        productId: item.id,
        productName: item.name,
        quantity: 20 - item.quantity // Order enough to get back to 20
      })),
      status: 'draft',
      createdAt: new Date()
    }));
    
    return {
      purchaseOrders,
      count: purchaseOrders.length
    };
  })
  .test('unit', (task) => [
    {
      name: 'Create purchase orders for low stock items',
      setup: () => ({
        input: {
          lowStockItems: [
            { id: 'p1', name: 'Product 1', quantity: 5 },
            { id: 'p3', name: 'Product 3', quantity: 8 }
          ]
        },
        context: {
          suppliers: [
            { 
              id: 's1', 
              name: 'Supplier 1', 
              products: ['p1', 'p2'] 
            },
            { 
              id: 's2', 
              name: 'Supplier 2', 
              products: ['p3', 'p4'] 
            }
          ]
        }
      }),
      execute: async (setup) => task(setup.input, setup.context),
      verify: (result, setup) => {
        if (result.count !== 2) {
          throw new Error(`Expected 2 purchase orders, got ${result.count}`);
        }
        
        const po1 = result.purchaseOrders.find((po: any) => po.supplierId === 's1');
        const po2 = result.purchaseOrders.find((po: any) => po.supplierId === 's2');
        
        if (!po1) {
          throw new Error('Expected purchase order for Supplier 1');
        }
        
        if (!po2) {
          throw new Error('Expected purchase order for Supplier 2');
        }
        
        if (po1.items.length !== 1) {
          throw new Error(`Expected 1 item in purchase order for Supplier 1, got ${po1.items.length}`);
        }
        
        if (po2.items.length !== 1) {
          throw new Error(`Expected 1 item in purchase order for Supplier 2, got ${po2.items.length}`);
        }
        
        if (po1.items[0].productId !== 'p1') {
          throw new Error(`Expected product p1 in purchase order for Supplier 1, got ${po1.items[0].productId}`);
        }
        
        if (po2.items[0].productId !== 'p3') {
          throw new Error(`Expected product p3 in purchase order for Supplier 2, got ${po2.items[0].productId}`);
        }
      }
    }
  ])
  .build();

// Task: Send Purchase Order
inventorySystem
  .withTask('send-purchase-order')
  .withName('Send Purchase Order')
  .withDescription('Send a purchase order to a supplier')
  .implementation(async (input: { purchaseOrder: any }, context: { emailService: any }) => {
    // In a real implementation, this would send an email to the supplier
    const emailResult = await context.emailService.sendEmail({
      to: `${input.purchaseOrder.supplierName} <supplier@example.com>`,
      subject: `Purchase Order ${input.purchaseOrder.id}`,
      body: `Please fulfill the following order:\n\n${JSON.stringify(input.purchaseOrder, null, 2)}`
    });
    
    return {
      success: emailResult.success,
      purchaseOrderId: input.purchaseOrder.id,
      sentAt: new Date()
    };
  })
  .build();

// -----------------------------------------------------------------------------
// Define Processes
// -----------------------------------------------------------------------------

// Process: Stock Management
inventorySystem
  .withProcess('stock-management')
  .withName('Stock Management')
  .withDescription('Process for managing stock levels and reordering')
  .initialState('idle')
  
  // Idle state
  .state('idle')
  .withDescription('Waiting for stock check')
  .on('check_stock').transitionTo('checking_stock')
  .build()
  
  // Checking stock state
  .state('checking_stock')
  .withDescription('Checking stock levels')
  .withTask('check-stock-levels')
  .on('stock_ok').transitionTo('idle')
  .on('stock_low').transitionTo('creating_purchase_order')
  .build()
  
  // Creating purchase order state
  .state('creating_purchase_order')
  .withDescription('Creating purchase orders for low stock items')
  .withTask('create-purchase-order')
  .on('order_created').transitionTo('sending_purchase_order')
  .build()
  
  // Sending purchase order state
  .state('sending_purchase_order')
  .withDescription('Sending purchase orders to suppliers')
  .withTask('send-purchase-order')
  .on('order_sent').transitionTo('idle')
  .build()
  
  .build();

// -----------------------------------------------------------------------------
// Assemble the System
// -----------------------------------------------------------------------------

// Assemble the system
const assembler = createAssembler();
const builtSystem = inventorySystem.build();
const assembledSystem = assembler.assemble(builtSystem);

console.log('Inventory Management System assembled successfully:');
console.log(`- ID: ${assembledSystem.id}`);
console.log(`- Name: ${assembledSystem.name}`);
console.log(`- Processes: ${Object.keys(assembledSystem.processes).length}`);
console.log(`- Tasks: ${Object.keys(assembledSystem.tasks).length}`);

// -----------------------------------------------------------------------------
// Run Tests
// -----------------------------------------------------------------------------

async function runTests() {
  console.log('\nRunning tests...');
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const taskId in assembledSystem.tasks) {
    const task = assembledSystem.tasks[taskId];
    
    if (task.tests && task.tests.length > 0) {
      console.log(`\nRunning tests for task '${task.name || task.id}':`);
      
      for (const test of task.tests) {
        process.stdout.write(`  - ${test.name}... `);
        
        try {
          const result = await test.run();
          
          if (result) {
            console.log('✅ PASSED');
            passedTests++;
          } else {
            console.log('❌ FAILED');
            failedTests++;
          }
        } catch (error: any) {
          console.log('❌ FAILED');
          console.error(`    Error: ${error.message}`);
          failedTests++;
        }
      }
    }
  }
  
  console.log(`\nTest Results: ${passedTests} passed, ${failedTests} failed`);
}

// Run the tests
runTests().catch((error: any) => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 