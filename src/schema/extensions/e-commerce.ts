/**
 * E-Commerce Domain Extension
 * 
 * This module provides an extension for e-commerce domain concepts,
 * including products, orders, customers, and inventory management.
 */

import { z } from 'zod';
import type { SchemaExtension } from '../extensions/extension-registry';

/**
 * Product schema
 */
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  sku: z.string(),
  categories: z.array(z.string()),
  attributes: z.record(z.string(), z.any()),
  inventory: z.object({
    quantity: z.number().int().min(0),
    reserved: z.number().int().min(0),
    available: z.number().int().min(0)
  })
});

/**
 * Order item schema
 */
export const OrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  discounts: z.array(z.object({
    type: z.string(),
    amount: z.number().positive(),
    description: z.string().optional()
  })).optional()
});

/**
 * Order schema
 */
export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  items: z.array(OrderItemSchema),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  paymentStatus: z.enum(['pending', 'authorized', 'paid', 'refunded', 'failed']),
  shippingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string()
  }),
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string()
  }).optional(),
  paymentMethod: z.object({
    type: z.enum(['credit_card', 'paypal', 'bank_transfer', 'crypto']),
    details: z.record(z.string(), z.any())
  }),
  totals: z.object({
    subtotal: z.number().positive(),
    tax: z.number().min(0),
    shipping: z.number().min(0),
    discount: z.number().min(0),
    total: z.number().positive()
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

/**
 * Customer schema
 */
export const CustomerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  addresses: z.array(z.object({
    id: z.string(),
    type: z.enum(['billing', 'shipping']),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    isDefault: z.boolean().optional()
  })),
  paymentMethods: z.array(z.object({
    id: z.string(),
    type: z.enum(['credit_card', 'paypal', 'bank_transfer', 'crypto']),
    details: z.record(z.string(), z.any()),
    isDefault: z.boolean().optional()
  })),
  preferences: z.object({
    marketingEmails: z.boolean().optional(),
    language: z.string().optional(),
    currency: z.string().optional()
  }).optional()
});

/**
 * Inventory transaction schema
 */
export const InventoryTransactionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  type: z.enum(['receive', 'ship', 'adjust', 'reserve', 'release']),
  quantity: z.number().int(),
  reference: z.object({
    type: z.enum(['order', 'purchase_order', 'manual', 'return']),
    id: z.string()
  }),
  notes: z.string().optional(),
  createdAt: z.string().datetime()
});

// Define types for the e-commerce extension
type Product = z.infer<typeof ProductSchema>;
type Order = z.infer<typeof OrderSchema>;
type Customer = z.infer<typeof CustomerSchema>;
type InventoryTransaction = z.infer<typeof InventoryTransactionSchema>;

// Define the e-commerce system structure
interface ECommerceSystem {
  ecommerce?: {
    products?: Record<string, Product>;
    orders?: Record<string, Order>;
    customers?: Record<string, Customer>;
    inventoryTransactions?: Record<string, InventoryTransaction>;
  };
}

/**
 * E-commerce extension
 */
export const ECommerceExtension: SchemaExtension = {
  id: 'e-commerce',
  name: 'E-Commerce Extension',
  description: 'Extends the reactive system schema with e-commerce concepts',
  version: '1.0.0',
  
  schemas: {
    Product: ProductSchema,
    Order: OrderSchema,
    Customer: CustomerSchema,
    InventoryTransaction: InventoryTransactionSchema
  },
  
  refinements: [
    (schema: any) => {
      // Create a new schema that includes the e-commerce extension
      return z.object({
        ...schema.shape, // Include all properties from the original schema
        ecommerce: z.object({
          products: z.record(z.string(), ProductSchema),
          orders: z.record(z.string(), OrderSchema),
          customers: z.record(z.string(), CustomerSchema),
          inventoryTransactions: z.record(z.string(), InventoryTransactionSchema)
        }).optional()
      });
    }
  ],
  
  validators: [
    (system: ECommerceSystem) => {
      const results: Array<{
        path: string;
        message: string;
        severity: 'error' | 'warning';
      }> = [];
      
      // Skip validation if e-commerce extension is not used
      if (!system.ecommerce) {
        return results;
      }
      
      // Validate product references in orders
      if (system.ecommerce.orders) {
        for (const [orderId, order] of Object.entries(system.ecommerce.orders)) {
          for (const [index, item] of order.items.entries()) {
            if (!system.ecommerce.products?.[item.productId]) {
              results.push({
                path: `ecommerce.orders.${orderId}.items[${index}].productId`,
                message: `Order references non-existent product: ${item.productId}`,
                severity: 'error'
              });
            }
          }
        }
      }
      
      // Validate customer references in orders
      if (system.ecommerce.orders) {
        for (const [orderId, order] of Object.entries(system.ecommerce.orders)) {
          if (!system.ecommerce.customers?.[order.customerId]) {
            results.push({
              path: `ecommerce.orders.${orderId}.customerId`,
              message: `Order references non-existent customer: ${order.customerId}`,
              severity: 'error'
            });
          }
        }
      }
      
      // Validate product references in inventory transactions
      if (system.ecommerce.inventoryTransactions) {
        for (const [txId, tx] of Object.entries(system.ecommerce.inventoryTransactions)) {
          if (!system.ecommerce.products?.[tx.productId]) {
            results.push({
              path: `ecommerce.inventoryTransactions.${txId}.productId`,
              message: `Inventory transaction references non-existent product: ${tx.productId}`,
              severity: 'error'
            });
          }
        }
      }
      
      // Validate inventory consistency
      if (system.ecommerce.products) {
        for (const [productId, product] of Object.entries(system.ecommerce.products)) {
          if (product.inventory.quantity < product.inventory.reserved) {
            results.push({
              path: `ecommerce.products.${productId}.inventory`,
              message: `Product has more reserved items (${product.inventory.reserved}) than total quantity (${product.inventory.quantity})`,
              severity: 'error'
            });
          }
          
          if (product.inventory.available !== (product.inventory.quantity - product.inventory.reserved)) {
            results.push({
              path: `ecommerce.products.${productId}.inventory.available`,
              message: `Product available quantity (${product.inventory.available}) does not match quantity (${product.inventory.quantity}) minus reserved (${product.inventory.reserved})`,
              severity: 'warning'
            });
          }
        }
      }
      
      return results;
    }
  ]
}; 