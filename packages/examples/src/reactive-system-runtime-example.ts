/**
 * Inventory Management System Example using Reactive System DSL
 * 
 * This example demonstrates how to use the Reactive System DSL to define
 * and run an inventory management system.
 */

import { ReactiveSystem } from '../src/core/dsl/reactive-system';
import { createAssembler } from '../src/core/dsl/assembler';
import { createRuntime } from '../src/core/dsl/runtime';

// Define the inventory management system
const inventorySystem = ReactiveSystem.define('inventory-system')
  .withName('Inventory Management System')
  .withDescription('A system for managing inventory and automatically creating purchase orders')
  .withMetadata({
    version: '1.0.0',
    author: 'ArchitectLM',
    tags: ['inventory', 'purchase-orders']
  });

// Task: Check Stock Levels
inventorySystem
  .withTask('check-stock-levels')
  .withName('Check Stock Levels')
  .withDescription('Check inventory levels and identify items that need to be reordered')
  .implementation(async (input: { products: Array<{ id: string, name: string, stock: number, minStock: number }> }, context) => {
    console.log('Checking stock levels...');
    
    // Find products with stock below minimum level
    const lowStockItems = input.products.filter(product => product.stock < product.minStock);
    
    console.log(`Found ${lowStockItems.length} items with low stock`);
    
    // If we found low stock items, emit an event
    if (lowStockItems.length > 0) {
      context.emitEvent('low-stock-detected', { lowStockItems });
    }
    
    return { lowStockItems };
  })
  .test('unit', (task) => [
    {
      name: 'should identify low stock items',
      input: {
        products: [
          { id: 'p1', name: 'Product 1', stock: 5, minStock: 10 },
          { id: 'p2', name: 'Product 2', stock: 15, minStock: 10 },
          { id: 'p3', name: 'Product 3', stock: 2, minStock: 5 }
        ]
      },
      context: {},
      expected: (result) => {
        if (result.lowStockItems.length !== 2) {
          throw new Error('Should find 2 low stock items');
        }
        if (!result.lowStockItems.find(item => item.id === 'p1')) {
          throw new Error('Product 1 should be low on stock');
        }
        if (result.lowStockItems.find(item => item.id === 'p2')) {
          throw new Error('Product 2 should not be low on stock');
        }
        if (!result.lowStockItems.find(item => item.id === 'p3')) {
          throw new Error('Product 3 should be low on stock');
        }
      }
    }
  ])
  .build();

// Task: Create Purchase Order
inventorySystem
  .withTask('create-purchase-order')
  .withName('Create Purchase Order')
  .withDescription('Create purchase orders for items that need to be reordered')
  .implementation(async (input: { lowStockItems: Array<{ id: string, name: string, stock: number, minStock: number }> }, context) => {
    console.log('Creating purchase orders...');
    
    // Group items by supplier (in a real system, this would be more complex)
    const itemsBySupplier: Record<string, any[]> = {};
    
    // For this example, we'll just assign suppliers randomly
    input.lowStockItems.forEach(item => {
      const supplierId = `supplier-${Math.floor(Math.random() * 3) + 1}`;
      
      if (!itemsBySupplier[supplierId]) {
        itemsBySupplier[supplierId] = [];
      }
      
      itemsBySupplier[supplierId].push({
        productId: item.id,
        productName: item.name,
        quantity: item.minStock - item.stock
      });
    });
    
    // Create purchase orders
    const purchaseOrders = Object.entries(itemsBySupplier).map(([supplierId, items]) => ({
      id: `po-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      supplierId,
      items,
      status: 'created',
      createdAt: new Date()
    }));
    
    console.log(`Created ${purchaseOrders.length} purchase orders`);
    
    // If we created purchase orders, emit an event
    if (purchaseOrders.length > 0) {
      context.emitEvent('purchase-orders-created', { purchaseOrders });
    }
    
    return { purchaseOrders };
  })
  .test('unit', (task) => [
    {
      name: 'should create purchase orders for low stock items',
      input: {
        lowStockItems: [
          { id: 'p1', name: 'Product 1', stock: 5, minStock: 10 },
          { id: 'p3', name: 'Product 3', stock: 2, minStock: 5 }
        ]
      },
      context: {},
      expected: (result) => {
        if (result.purchaseOrders.length === 0) {
          throw new Error('Should create at least one purchase order');
        }
        
        // Check that all items are included in purchase orders
        const allOrderedItems = result.purchaseOrders.flatMap(po => po.items);
        if (allOrderedItems.length !== 2) {
          throw new Error('Should order 2 items in total');
        }
      }
    }
  ])
  .build();

// Task: Send Purchase Order
inventorySystem
  .withTask('send-purchase-order')
  .withName('Send Purchase Order')
  .withDescription('Send purchase orders to suppliers')
  .implementation(async (input: { purchaseOrders: Array<{ id: string, supplierId: string, items: any[], status: string }> }, context) => {
    console.log('Sending purchase orders to suppliers...');
    
    // In a real system, this would send emails, API calls, etc.
    const sentPurchaseOrders = input.purchaseOrders.map(po => ({
      ...po,
      status: 'sent',
      sentAt: new Date()
    }));
    
    console.log(`Sent ${sentPurchaseOrders.length} purchase orders`);
    
    // Emit an event for each sent purchase order
    sentPurchaseOrders.forEach(po => {
      context.emitEvent('purchase-order-sent', { purchaseOrder: po });
    });
    
    return { sentPurchaseOrders };
  })
  .build();

// Process: Stock Management
const stockManagementProcess = inventorySystem
  .withProcess('stock-management')
  .withName('Stock Management Process')
  .withDescription('Process for managing stock levels and creating purchase orders')
  .initialState('idle');

// State: Idle
const idleState = stockManagementProcess
  .state('idle')
  .withDescription('Waiting for stock check trigger');

// Add transition from idle to checking-stock
idleState
  .on('check-stock')
  .transitionTo('checking-stock')
  .withDescription('Start checking stock levels')
  .build();

// Build the idle state
idleState.build();

// State: Checking Stock
const checkingStockState = stockManagementProcess
  .state('checking-stock')
  .withDescription('Checking stock levels')
  .withTask('check-stock-levels');

// Add transitions from checking-stock
checkingStockState
  .on('low-stock-detected')
  .transitionTo('creating-purchase-orders')
  .withDescription('Low stock detected, create purchase orders')
  .build();

checkingStockState
  .on('stock-ok')
  .transitionTo('idle')
  .withDescription('Stock levels are OK, return to idle')
  .build();

// Build the checking-stock state
checkingStockState.build();

// State: Creating Purchase Orders
const creatingPurchaseOrdersState = stockManagementProcess
  .state('creating-purchase-orders')
  .withDescription('Creating purchase orders')
  .withTask('create-purchase-order');

// Add transition from creating-purchase-orders to sending-purchase-orders
creatingPurchaseOrdersState
  .on('purchase-orders-created')
  .transitionTo('sending-purchase-orders')
  .withDescription('Purchase orders created, send to suppliers')
  .build();

// Build the creating-purchase-orders state
creatingPurchaseOrdersState.build();

// State: Sending Purchase Orders
const sendingPurchaseOrdersState = stockManagementProcess
  .state('sending-purchase-orders')
  .withDescription('Sending purchase orders to suppliers')
  .withTask('send-purchase-order');

// Add transition from sending-purchase-orders to idle
sendingPurchaseOrdersState
  .on('purchase-order-sent')
  .transitionTo('idle')
  .withDescription('Purchase orders sent, return to idle')
  .build();

// Build the sending-purchase-orders state
sendingPurchaseOrdersState.build();

// Build the process
stockManagementProcess.build();

// Build the system
const builtSystem = inventorySystem.build();

/**
 * Run the inventory management system
 */
async function runInventorySystem() {
  try {
    console.log('Starting runInventorySystem...');
    
    // Assemble the system
    const assembler = createAssembler();
    console.log('Created assembler');
    
    const assembledSystem = assembler.assemble(builtSystem);
    console.log('Assembled system');
    
    console.log(`Assembled system: ${assembledSystem.name}`);
    console.log(`- ID: ${assembledSystem.id}`);
    console.log(`- Processes: ${Object.keys(assembledSystem.processes).length}`);
    console.log(`- Tasks: ${Object.keys(assembledSystem.tasks).length}`);
    
    // Create a runtime
    const runtime = createRuntime(assembledSystem);
    console.log('Created runtime');
    
    // Register mock services
    runtime.registerService('inventoryApi', {
      getProducts: async () => [
        { id: 'p1', name: 'Laptop', stock: 5, minStock: 10 },
        { id: 'p2', name: 'Monitor', stock: 15, minStock: 10 },
        { id: 'p3', name: 'Keyboard', stock: 2, minStock: 5 },
        { id: 'p4', name: 'Mouse', stock: 8, minStock: 10 }
      ]
    });
    console.log('Registered inventoryApi service');
    
    runtime.registerService('supplierApi', {
      sendPurchaseOrder: async (purchaseOrder: any) => {
        console.log(`Sending purchase order ${purchaseOrder.id} to supplier ${purchaseOrder.supplierId}`);
        return { success: true, reference: `REF-${Math.floor(Math.random() * 10000)}` };
      }
    });
    console.log('Registered supplierApi service');
    
    // Create a promise that will be resolved when the process returns to idle state
    const processCompletedPromise = new Promise<void>((resolve) => {
      // Subscribe to state transition events
      runtime.on('process.transitioned', (event: any) => {
        // If the process transitions to idle state after being in sending-purchase-orders state,
        // it means the process has completed a full cycle
        if (event.payload?.to === 'idle' && event.payload?.from === 'sending-purchase-orders') {
          resolve();
        }
      });
    });
    
    // Subscribe to all events
    runtime.on('*', (event) => {
      console.log(`Event: ${event.type}`, event.payload);
    });
    console.log('Subscribed to events');
    
    // Create a process instance
    const instance = runtime.createProcessInstance('stock-management');
    console.log(`Created process instance: ${instance.id}`);
    
    // Get products from the inventory API
    const inventoryApi = runtime.getService<{ getProducts: () => Promise<any[]> }>('inventoryApi');
    const products = await inventoryApi.getProducts();
    console.log('Got products from inventoryApi:', products.length);
    
    // Start the process by sending a check-stock event
    console.log('Sending check-stock event...');
    await runtime.sendEvent(instance.id, 'check-stock', { products });
    console.log('Sent check-stock event');
    
    // Wait for the process to complete
    console.log('Waiting for process to complete...');
    await processCompletedPromise;
    
    // Get the final state of the process
    const finalInstance = runtime.getProcessInstance(instance.id);
    
    console.log('Process completed successfully');
    console.log('Final state:', finalInstance?.state);
    console.log('State history:');
    finalInstance?.history.forEach((transition, index) => {
      console.log(`  ${index + 1}. ${transition.from} -> ${transition.to} (${transition.event})`);
    });
    
    return finalInstance;
  } catch (error) {
    console.error('Error running inventory system:', error);
    throw error;
  }
}

// Run the example
runInventorySystem()
  .then(() => console.log('Example completed successfully'))
  .catch(error => console.error('Example failed:', error)); 