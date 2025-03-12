/**
 * Example Schemas Tests
 * 
 * Tests for validating the example schemas in the examples directory.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateSchema } from '../../../src/cli/schema-validator';
import { loadSchemaFiles } from '../../../src/cli/schema-loader';
import '../../../src/schema/extensions'; // Import to ensure extensions are registered

describe('Example Schemas', () => {
  const examplesDir = path.resolve(__dirname, '../../../examples');
  
  describe('Todo System Schema', () => {
    it('should validate the todo system schema', async () => {
      // Load the todo system schema
      const todoSchemaPath = path.join(examplesDir, 'todo-system.json');
      const schemaFiles = await loadSchemaFiles(todoSchemaPath);
      
      // Validate the schema
      const validationResult = validateSchema(schemaFiles);
      
      // Check validation result
      expect(validationResult.success).toBe(true);
      expect(validationResult.issues.length).toBe(0);
    });
    
    it('should contain all required components', async () => {
      // Load the todo system schema
      const todoSchemaPath = path.join(examplesDir, 'todo-system.json');
      const todoSchemaContent = JSON.parse(fs.readFileSync(todoSchemaPath, 'utf-8'));
      
      // Check basic properties
      expect(todoSchemaContent.id).toBe('todo-system');
      expect(todoSchemaContent.name).toBe('Todo System');
      expect(todoSchemaContent.version).toBe('1.0.0');
      
      // Check bounded contexts
      expect(todoSchemaContent.boundedContexts).toBeDefined();
      expect(todoSchemaContent.boundedContexts.todos).toBeDefined();
      expect(todoSchemaContent.boundedContexts.todos.id).toBe('todos');
      
      // Check processes
      expect(todoSchemaContent.processes).toBeDefined();
      expect(todoSchemaContent.processes['manage-todos']).toBeDefined();
      expect(todoSchemaContent.processes['manage-lists']).toBeDefined();
      
      // Check tasks
      expect(todoSchemaContent.tasks).toBeDefined();
      expect(todoSchemaContent.tasks['validate-todo']).toBeDefined();
      expect(todoSchemaContent.tasks['save-todo']).toBeDefined();
      expect(todoSchemaContent.tasks['update-todo']).toBeDefined();
      expect(todoSchemaContent.tasks['delete-todo']).toBeDefined();
      expect(todoSchemaContent.tasks['validate-list']).toBeDefined();
      expect(todoSchemaContent.tasks['save-list']).toBeDefined();
      expect(todoSchemaContent.tasks['update-list']).toBeDefined();
      expect(todoSchemaContent.tasks['delete-list']).toBeDefined();
    });
  });
  
  describe('E-Commerce System Schema', () => {
    it('should validate the e-commerce system schema without issues', async () => {
      // Load the e-commerce system schema
      const ecommerceSchemaPath = path.join(examplesDir, 'e-commerce-system.json');
      const schemaFiles = await loadSchemaFiles(ecommerceSchemaPath);
      
      // Validate the schema
      const validationResult = validateSchema(schemaFiles);
      
      // Check validation result
      expect(validationResult.success).toBe(true);
      expect(validationResult.issues.length).toBe(0);
    });
    
    it('should contain all required components', async () => {
      // Load the e-commerce system schema
      const ecommerceSchemaPath = path.join(examplesDir, 'e-commerce-system.json');
      const ecommerceSchemaContent = JSON.parse(fs.readFileSync(ecommerceSchemaPath, 'utf-8'));
      
      // Check basic properties
      expect(ecommerceSchemaContent.id).toBe('e-commerce-system');
      expect(ecommerceSchemaContent.name).toBe('E-Commerce System');
      expect(ecommerceSchemaContent.version).toBe('1.0.0');
      
      // Check e-commerce extension
      expect(ecommerceSchemaContent.ecommerce).toBeDefined();
      expect(ecommerceSchemaContent.ecommerce.enabled).toBe(true);
      expect(ecommerceSchemaContent.ecommerce.currency).toBe('USD');
      expect(ecommerceSchemaContent.ecommerce.paymentMethods).toContain('credit_card');
      expect(ecommerceSchemaContent.ecommerce.paymentMethods).toContain('paypal');
      
      // Check products
      expect(ecommerceSchemaContent.ecommerce.products).toBeDefined();
      expect(Object.keys(ecommerceSchemaContent.ecommerce.products).length).toBeGreaterThan(0);
      expect(ecommerceSchemaContent.ecommerce.products['product-1']).toBeDefined();
      expect(ecommerceSchemaContent.ecommerce.products['product-1'].name).toBe('Smartphone X');
      
      // Check bounded contexts
      expect(ecommerceSchemaContent.boundedContexts).toBeDefined();
      expect(ecommerceSchemaContent.boundedContexts.catalog).toBeDefined();
      expect(ecommerceSchemaContent.boundedContexts.orders).toBeDefined();
      expect(ecommerceSchemaContent.boundedContexts.customers).toBeDefined();
      
      // Check processes
      expect(ecommerceSchemaContent.processes).toBeDefined();
      expect(ecommerceSchemaContent.processes['manage-products']).toBeDefined();
      expect(ecommerceSchemaContent.processes['manage-inventory']).toBeDefined();
      expect(ecommerceSchemaContent.processes['process-order']).toBeDefined();
      expect(ecommerceSchemaContent.processes['manage-returns']).toBeDefined();
      expect(ecommerceSchemaContent.processes['manage-customers']).toBeDefined();
      expect(ecommerceSchemaContent.processes['manage-addresses']).toBeDefined();
      
      // Check tasks (sample)
      expect(ecommerceSchemaContent.tasks).toBeDefined();
      expect(ecommerceSchemaContent.tasks['validate-product']).toBeDefined();
      expect(ecommerceSchemaContent.tasks['process-payment']).toBeDefined();
      expect(ecommerceSchemaContent.tasks['validate-customer']).toBeDefined();
    });
  });
}); 