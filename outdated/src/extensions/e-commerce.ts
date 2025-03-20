/**
 * E-commerce Domain Extension
 * 
 * This module provides an extension for e-commerce domain entities and validation.
 */

import { SchemaExtension } from '../core/extension-system';

// Define interfaces for the domain entities
interface Product {
  sku: string;
  price: number;
  currency?: string;
  inventory?: {
    quantity: number;
    warehouse?: string;
  };
  [key: string]: any;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  [key: string]: any;
}

interface Order {
  items: OrderItem[];
  shipping?: {
    address: string;
    method: string;
    cost?: number;
  };
  payment?: {
    method: string;
    transactionId?: string;
    amount: number;
  };
  status?: string;
  customer: {
    id: string;
    email: string;
    name?: string;
  };
  [key: string]: any;
}

interface CartItem {
  productId: string;
  quantity: number;
  addedAt?: string;
  [key: string]: any;
}

interface Cart {
  customerId: string;
  items: CartItem[];
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  [key: string]: any;
}

/**
 * E-commerce extension for reactive systems
 */
export const ECommerceExtension: SchemaExtension = {
  id: 'e-commerce',
  name: 'E-commerce Extension',
  version: '1.0.0',
  description: 'Extends the schema for e-commerce applications',
  domain: 'e-commerce',
  
  schemas: {
    Product: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        price: { type: 'number' },
        currency: { type: 'string' },
        inventory: {
          type: 'object',
          properties: {
            quantity: { type: 'number' },
            warehouse: { type: 'string' }
          }
        },
        categories: {
          type: 'array',
          items: { type: 'string' }
        },
        attributes: {
          type: 'object',
          additionalProperties: true
        }
      },
      required: ['sku', 'price']
    },
    
    Order: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'number' }
            },
            required: ['productId', 'quantity', 'price']
          }
        },
        shipping: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            method: { type: 'string' },
            cost: { type: 'number' }
          },
          required: ['address', 'method']
        },
        payment: {
          type: 'object',
          properties: {
            method: { type: 'string' },
            transactionId: { type: 'string' },
            amount: { type: 'number' }
          },
          required: ['method', 'amount']
        },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
        },
        customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['id', 'email']
        }
      },
      required: ['items', 'customer']
    },
    
    Cart: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' },
              addedAt: { type: 'string', format: 'date-time' }
            },
            required: ['productId', 'quantity']
          }
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        status: {
          type: 'string',
          enum: ['active', 'abandoned', 'converted']
        }
      },
      required: ['customerId', 'items']
    }
  },
  
  validators: {
    Product: (product: Product) => {
      const errors: string[] = [];
      
      if (!product.sku) {
        errors.push('Product must have SKU');
      }
      
      if (typeof product.price !== 'number' || product.price <= 0) {
        errors.push('Product price must be a positive number');
      }
      
      if (product.inventory && typeof product.inventory.quantity !== 'number') {
        errors.push('Inventory quantity must be a number');
      }
      
      return { valid: errors.length === 0, errors };
    },
    
    Order: (order: Order) => {
      const errors: string[] = [];
      
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        errors.push('Order must have at least one item');
      }
      
      if (order.items) {
        order.items.forEach((item: OrderItem, index: number) => {
          if (!item.productId) {
            errors.push(`Item ${index} must have a productId`);
          }
          
          if (typeof item.quantity !== 'number' || item.quantity <= 0) {
            errors.push(`Item ${index} must have a positive quantity`);
          }
          
          if (typeof item.price !== 'number' || item.price < 0) {
            errors.push(`Item ${index} must have a valid price`);
          }
        });
      }
      
      if (order.status && !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(order.status)) {
        errors.push('Invalid order status');
      }
      
      if (order.payment && typeof order.payment.amount !== 'number') {
        errors.push('Payment amount must be a number');
      }
      
      return { valid: errors.length === 0, errors };
    },
    
    Cart: (cart: Cart) => {
      const errors: string[] = [];
      
      if (!cart.customerId) {
        errors.push('Cart must have a customer ID');
      }
      
      if (!cart.items || !Array.isArray(cart.items)) {
        errors.push('Cart must have items array');
      } else if (cart.items.length === 0) {
        errors.push('Cart must have at least one item');
      }
      
      if (cart.status && !['active', 'abandoned', 'converted'].includes(cart.status)) {
        errors.push('Invalid cart status');
      }
      
      return { valid: errors.length === 0, errors };
    }
  },
  
  transformers: {
    Product: (product: Product) => {
      const transformed = { ...product };
      
      // Add display price
      if (typeof product.price === 'number') {
        transformed.displayPrice = product.currency 
          ? `${product.currency} ${product.price.toFixed(2)}`
          : `$${product.price.toFixed(2)}`;
      }
      
      // Add in-stock status
      const inventoryQuantity = product.inventory?.quantity;
      transformed.inStock = (inventoryQuantity !== undefined && inventoryQuantity > 0) || false;
      
      // Add low stock warning
      if (inventoryQuantity !== undefined) {
        transformed.lowStock = inventoryQuantity > 0 && inventoryQuantity <= 5;
      }
      
      return transformed;
    },
    
    Order: (order: Order) => {
      const transformed = { ...order };
      
      // Calculate order total
      if (order.items && Array.isArray(order.items)) {
        const itemsTotal = order.items.reduce(
          (total: number, item: OrderItem) => total + (item.price * item.quantity), 
          0
        );
        
        const shippingCost = order.shipping?.cost || 0;
        
        transformed.total = itemsTotal + shippingCost;
        transformed.itemCount = order.items.reduce((count: number, item: OrderItem) => count + item.quantity, 0);
      }
      
      // Add status display
      if (order.status) {
        const statusMap: Record<string, string> = {
          'pending': 'Pending',
          'processing': 'Processing',
          'shipped': 'Shipped',
          'delivered': 'Delivered',
          'cancelled': 'Cancelled'
        };
        
        transformed.statusDisplay = statusMap[order.status] || order.status;
      }
      
      return transformed;
    },
    
    Cart: (cart: Cart) => {
      const transformed = { ...cart };
      
      // Calculate cart total and item count
      if (cart.items && Array.isArray(cart.items)) {
        transformed.itemCount = cart.items.reduce((count: number, item: CartItem) => count + item.quantity, 0);
      }
      
      // Add age in minutes
      if (cart.createdAt) {
        const createdDate = new Date(cart.createdAt);
        const now = new Date();
        const ageInMinutes = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60));
        
        transformed.ageInMinutes = ageInMinutes;
        transformed.isAbandoned = ageInMinutes > 60 && cart.status === 'active';
      }
      
      return transformed;
    }
  }
}; 