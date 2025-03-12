/**
 * E-Commerce Domain Extension
 * 
 * This module provides an extension for e-commerce domain concepts,
 * including products, orders, customers, and inventory management.
 */

import { z } from 'zod';
import { SchemaExtension, extensionRegistry, ExtensionValidationIssue } from './extension-registry';

/**
 * Product type
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  sku: string;
  categories: string[];
  attributes: Record<string, any>;
  inventory: {
    quantity: number;
    reserved: number;
    available: number;
  };
}

/**
 * Order type
 */
export interface Order {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  shippingAddress: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: {
    type: string;
    details: Record<string, any>;
  };
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Customer type
 */
export interface Customer {
  id: string;
  email: string;
  name: string;
  addresses: Array<{
    type: 'billing' | 'shipping';
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  paymentMethods: Array<{
    id: string;
    type: string;
    details: Record<string, any>;
  }>;
}

/**
 * Inventory transaction type
 */
export interface InventoryTransaction {
  id: string;
  productId: string;
  quantity: number;
  type: 'addition' | 'reduction';
  reason: string;
  createdAt: string;
}

/**
 * E-commerce system
 */
export interface ECommerceSystem {
  products: Record<string, Product>;
  orders: Record<string, Order>;
  customers: Record<string, Customer>;
  inventoryTransactions: Record<string, InventoryTransaction>;
}

/**
 * Product schema
 */
const ProductSchema = z.object({
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
 * Order schema
 */
const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  paymentStatus: z.enum(['pending', 'paid', 'refunded', 'failed']),
  shippingAddress: z.object({
    line1: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string()
  }),
  paymentMethod: z.object({
    type: z.string(),
    details: z.record(z.string(), z.any())
  }),
  totals: z.object({
    subtotal: z.number().min(0),
    tax: z.number().min(0),
    shipping: z.number().min(0),
    discount: z.number().min(0),
    total: z.number().min(0)
  }),
  createdAt: z.string(),
  updatedAt: z.string()
});

/**
 * Customer schema
 */
const CustomerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  addresses: z.array(z.object({
    type: z.enum(['billing', 'shipping']),
    line1: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string()
  })).optional().default([]),
  paymentMethods: z.array(z.object({
    id: z.string(),
    type: z.string(),
    details: z.record(z.string(), z.any())
  })).optional().default([])
});

/**
 * Inventory transaction schema
 */
const InventoryTransactionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int(),
  type: z.enum(['addition', 'reduction']),
  reason: z.string(),
  createdAt: z.string()
});

/**
 * Product validator
 */
const productValidator = (schema: any): ExtensionValidationIssue[] => {
  const issues: ExtensionValidationIssue[] = [];
  
  // Check if e-commerce extension is present
  if (!schema.ecommerce) {
    return issues;
  }
  
  // Check if products are defined
  if (!schema.ecommerce.products || Object.keys(schema.ecommerce.products).length === 0) {
    issues.push({
      path: 'ecommerce.products',
      message: 'No products defined in e-commerce extension',
      severity: 'warning'
    });
  }
  
  // Check inventory consistency for each product
  if (schema.ecommerce.products) {
    for (const [productId, product] of Object.entries<any>(schema.ecommerce.products)) {
      if (product.inventory) {
        // Check if reserved is greater than quantity
        if (product.inventory.reserved > product.inventory.quantity) {
          issues.push({
            path: `ecommerce.products.${productId}.inventory.reserved`,
            message: `Product has more reserved items (${product.inventory.reserved}) than total quantity (${product.inventory.quantity})`,
            severity: 'error'
          });
        }
        
        // Check if available is consistent with quantity and reserved
        const expectedAvailable = product.inventory.quantity - product.inventory.reserved;
        if (product.inventory.available !== expectedAvailable) {
          issues.push({
            path: `ecommerce.products.${productId}.inventory.available`,
            message: `Product available quantity (${product.inventory.available}) is inconsistent with quantity (${product.inventory.quantity}) minus reserved (${product.inventory.reserved})`,
            severity: 'warning'
          });
        }
      }
    }
  }
  
  return issues;
};

/**
 * Order validator
 */
const orderValidator = (schema: any): ExtensionValidationIssue[] => {
  const issues: ExtensionValidationIssue[] = [];
  
  // Check if e-commerce extension is present
  if (!schema.ecommerce) {
    return issues;
  }
  
  // Check if orders reference valid customers and products
  if (schema.ecommerce.orders) {
    for (const [orderId, order] of Object.entries<any>(schema.ecommerce.orders)) {
      // Check customer reference
      if (order.customerId && schema.ecommerce.customers) {
        if (!schema.ecommerce.customers[order.customerId]) {
          issues.push({
            path: `ecommerce.orders.${orderId}.customerId`,
            message: `Order references non-existent customer: ${order.customerId}`,
            severity: 'error'
          });
        }
      }
      
      // Check product references in order items
      if (order.items && schema.ecommerce.products) {
        for (let i = 0; i < order.items.length; i++) {
          const item = order.items[i];
          if (!schema.ecommerce.products[item.productId]) {
            issues.push({
              path: `ecommerce.orders.${orderId}.items[${i}].productId`,
              message: `Order item references non-existent product: ${item.productId}`,
              severity: 'error'
            });
          }
        }
      }
    }
  }
  
  return issues;
};

/**
 * E-commerce extension
 */
export const ECommerceExtension: SchemaExtension = {
  id: 'e-commerce',
  name: 'E-Commerce Extension',
  description: 'Extension for e-commerce domain',
  version: '1.0.0',
  schemas: {
    Product: ProductSchema,
    Order: OrderSchema,
    Customer: CustomerSchema,
    InventoryTransaction: InventoryTransactionSchema
  },
  refinements: [
    (schema) => {
      // Add e-commerce properties to the schema
      return z.object({
        ...(schema as any).shape,
        ecommerce: z.object({
          enabled: z.boolean().optional().default(true),
          currency: z.string().optional().default('USD'),
          paymentMethods: z.array(z.string()).optional(),
          products: z.record(z.string(), ProductSchema).optional(),
          orders: z.record(z.string(), OrderSchema).optional(),
          customers: z.record(z.string(), CustomerSchema).optional(),
          inventoryTransactions: z.record(z.string(), InventoryTransactionSchema).optional()
        }).optional()
      });
    }
  ],
  validators: [
    productValidator,
    orderValidator
  ]
};

// Register the e-commerce extension
extensionRegistry.registerExtension(ECommerceExtension); 