/**
 * E-Commerce Extension Tests
 * 
 * Tests for the e-commerce domain extension, including schema validation,
 * refinements, and validators.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ECommerceExtension } from '../../../src/schema/extensions/e-commerce';
import { extensionRegistry, SchemaExtensionRegistry } from '../../../src/schema/extensions/extension-registry';
import { ReactiveSystemSchema } from '../../../src/schema/validation';

describe('E-Commerce Extension', () => {
  let registry: SchemaExtensionRegistry;

  beforeEach(() => {
    // Create a fresh registry for each test
    registry = new SchemaExtensionRegistry();
    registry.registerExtension(ECommerceExtension);
  });

  describe('Extension Registration', () => {
    it('should register the e-commerce extension', () => {
      const extension = registry.getExtension('e-commerce');
      expect(extension).toBeDefined();
      expect(extension?.id).toBe('e-commerce');
      expect(extension?.name).toBe('E-Commerce Extension');
    });

    it('should contain all required schemas', () => {
      const extension = registry.getExtension('e-commerce');
      expect(extension?.schemas).toBeDefined();
      expect(extension?.schemas.Product).toBeDefined();
      expect(extension?.schemas.Order).toBeDefined();
      expect(extension?.schemas.Customer).toBeDefined();
      expect(extension?.schemas.InventoryTransaction).toBeDefined();
    });
  });

  describe('Schema Extension', () => {
    it('should create an extended schema with e-commerce capabilities', () => {
      const extendedSchema = registry.createExtendedSchema('e-commerce');
      
      // The extended schema should be a Zod schema
      expect(extendedSchema).toBeInstanceOf(z.ZodType);
      
      // Parse a simple system to ensure the schema works
      const result = extendedSchema.safeParse({
        id: 'test-system',
        name: 'Test System',
        description: 'A test system with e-commerce',
        version: '1.0.0',
        boundedContexts: {},
        processes: {},
        tasks: {},
        triggers: {},
        ecommerce: {
          products: {
            'product-1': {
              id: 'product-1',
              name: 'Test Product',
              description: 'A test product',
              price: 19.99,
              sku: 'TEST-001',
              categories: ['test'],
              attributes: {},
              inventory: {
                quantity: 100,
                reserved: 10,
                available: 90
              }
            }
          },
          customers: {},
          orders: {},
          inventoryTransactions: {}
        }
      });
      
      expect(result.success).toBe(true);
    });

    it('should reject invalid e-commerce data', () => {
      const extendedSchema = registry.createExtendedSchema('e-commerce');
      
      // Test with invalid product (negative price)
      const result = extendedSchema.safeParse({
        id: 'test-system',
        name: 'Test System',
        description: 'A test system with e-commerce',
        version: '1.0.0',
        boundedContexts: {},
        processes: {},
        tasks: {},
        triggers: {},
        ecommerce: {
          products: {
            'product-1': {
              id: 'product-1',
              name: 'Test Product',
              description: 'A test product',
              price: -19.99, // Invalid: negative price
              sku: 'TEST-001',
              categories: ['test'],
              attributes: {},
              inventory: {
                quantity: 100,
                reserved: 10,
                available: 90
              }
            }
          },
          customers: {},
          orders: {},
          inventoryTransactions: {}
        }
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate references between entities', () => {
      // Create a valid system with proper references
      const validSystem = {
        id: 'test-system',
        name: 'Test System',
        description: 'A test system with e-commerce',
        version: '1.0.0',
        boundedContexts: {},
        processes: {},
        tasks: {},
        triggers: {},
        ecommerce: {
          products: {
            'product-1': {
              id: 'product-1',
              name: 'Test Product',
              description: 'A test product',
              price: 19.99,
              sku: 'TEST-001',
              categories: ['test'],
              attributes: {},
              inventory: {
                quantity: 100,
                reserved: 10,
                available: 90
              }
            }
          },
          customers: {
            'customer-1': {
              id: 'customer-1',
              email: 'test@example.com',
              name: 'Test Customer',
              addresses: [],
              paymentMethods: []
            }
          },
          orders: {
            'order-1': {
              id: 'order-1',
              customerId: 'customer-1', // Valid reference
              items: [
                {
                  productId: 'product-1', // Valid reference
                  quantity: 2,
                  price: 19.99
                }
              ],
              status: 'pending',
              paymentStatus: 'pending',
              shippingAddress: {
                line1: '123 Test St',
                city: 'Test City',
                state: 'TS',
                postalCode: '12345',
                country: 'Testland'
              },
              paymentMethod: {
                type: 'credit_card',
                details: {}
              },
              totals: {
                subtotal: 39.98,
                tax: 3.20,
                shipping: 5.00,
                discount: 0,
                total: 48.18
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          inventoryTransactions: {}
        }
      };
      
      const validationResult = registry.validateWithExtensions(validSystem, 'e-commerce');
      expect(validationResult.success).toBe(true);
      expect(validationResult.issues.length).toBe(0);
      
      // Create an invalid system with broken references
      const invalidSystem = {
        id: 'test-system',
        name: 'Test System',
        description: 'A test system with e-commerce',
        version: '1.0.0',
        boundedContexts: {},
        processes: {},
        tasks: {},
        triggers: {},
        ecommerce: {
          products: {
            'product-1': {
              id: 'product-1',
              name: 'Test Product',
              description: 'A test product',
              price: 19.99,
              sku: 'TEST-001',
              categories: ['test'],
              attributes: {},
              inventory: {
                quantity: 100,
                reserved: 10,
                available: 90
              }
            }
          },
          customers: {
            'customer-1': {
              id: 'customer-1',
              email: 'test@example.com',
              name: 'Test Customer',
              addresses: [],
              paymentMethods: []
            }
          },
          orders: {
            'order-1': {
              id: 'order-1',
              customerId: 'non-existent-customer', // Invalid reference
              items: [
                {
                  productId: 'non-existent-product', // Invalid reference
                  quantity: 2,
                  price: 19.99
                }
              ],
              status: 'pending',
              paymentStatus: 'pending',
              shippingAddress: {
                line1: '123 Test St',
                city: 'Test City',
                state: 'TS',
                postalCode: '12345',
                country: 'Testland'
              },
              paymentMethod: {
                type: 'credit_card',
                details: {}
              },
              totals: {
                subtotal: 39.98,
                tax: 3.20,
                shipping: 5.00,
                discount: 0,
                total: 48.18
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          inventoryTransactions: {}
        }
      };
      
      const invalidValidationResult = registry.validateWithExtensions(invalidSystem, 'e-commerce');
      expect(invalidValidationResult.success).toBe(false);
      expect(invalidValidationResult.issues.length).toBeGreaterThan(0);
      
      // Check that the issues contain the expected error messages
      const customerIssue = invalidValidationResult.issues.find(
        issue => issue.path.includes('customerId')
      );
      expect(customerIssue).toBeDefined();
      expect(customerIssue?.message).toContain('non-existent-customer');
      
      const productIssue = invalidValidationResult.issues.find(
        issue => issue.path.includes('productId')
      );
      expect(productIssue).toBeDefined();
      expect(productIssue?.message).toContain('non-existent-product');
    });
    
    it('should validate inventory consistency', () => {
      // Create a system with inconsistent inventory
      const inconsistentSystem = {
        id: 'test-system',
        name: 'Test System',
        description: 'A test system with e-commerce',
        version: '1.0.0',
        boundedContexts: {},
        processes: {},
        tasks: {},
        triggers: {},
        ecommerce: {
          products: {
            'product-1': {
              id: 'product-1',
              name: 'Test Product',
              description: 'A test product',
              price: 19.99,
              sku: 'TEST-001',
              categories: ['test'],
              attributes: {},
              inventory: {
                quantity: 100,
                reserved: 150, // More reserved than total quantity
                available: 90  // Inconsistent available calculation
              }
            }
          },
          customers: {},
          orders: {},
          inventoryTransactions: {}
        }
      };
      
      const validationResult = registry.validateWithExtensions(inconsistentSystem, 'e-commerce');
      expect(validationResult.success).toBe(false);
      
      // Check that the issues contain the expected error messages
      const reservedIssue = validationResult.issues.find(
        issue => issue.message.includes('more reserved items')
      );
      expect(reservedIssue).toBeDefined();
      expect(reservedIssue?.severity).toBe('error');
      
      const availableIssue = validationResult.issues.find(
        issue => issue.message.includes('available quantity')
      );
      expect(availableIssue).toBeDefined();
      expect(availableIssue?.severity).toBe('warning');
    });
  });
}); 