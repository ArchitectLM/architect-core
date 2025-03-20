import { Extension } from '@architectlm/extensions';
import { DSL_EXTENSION_POINTS } from '../../src/dsl-extension-system.js';
import { ComponentType } from '../../src/types.js';

/**
 * Creates an e-commerce extension for the DSL
 */
export function createEcommerceExtension(): Extension {
  return {
    name: 'ecommerce-extension',
    description: 'Extension for e-commerce DSL',
    hooks: {
      // Validation hook
      [DSL_EXTENSION_POINTS.VALIDATE_COMPONENT]: (context: any) => {
        const { component, validationResult } = context;
        
        // Only process e-commerce components
        if (component.type === ComponentType.SCHEMA) {
          // Validate Order schema
          if (component.name === 'Order') {
            // Check if the order has required properties
            if (!component.definition.required?.includes('items')) {
              validationResult.isValid = false;
              validationResult.errors.push('Order schema must have items as a required property');
            }
            
            if (!component.definition.required?.includes('total')) {
              validationResult.isValid = false;
              validationResult.errors.push('Order schema must have total as a required property');
            }
            
            if (!component.definition.required?.includes('customer')) {
              validationResult.isValid = false;
              validationResult.errors.push('Order schema must have customer as a required property');
            }
          }
          
          // Validate Customer schema
          if (component.name === 'Customer') {
            // Check if the customer has required properties
            if (!component.definition.required?.includes('email')) {
              validationResult.isValid = false;
              validationResult.errors.push('Customer schema must have email as a required property');
            }
          }
        }
        
        return context;
      },
      
      // Compilation hook
      [DSL_EXTENSION_POINTS.COMPILE_COMPONENT]: (context: any) => {
        const { component, code } = context;
        
        // Only process command components
        if (component.type === ComponentType.COMMAND) {
          // Add e-commerce specific code
          let enhancedCode = code;
          
          // Add validation for order commands
          if (component.name.includes('Order')) {
            enhancedCode += `
// E-commerce validation
function validateOrder(order) {
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have at least one item');
  }
  
  if (!order.customer || !order.customer.email) {
    throw new Error('Order must have a customer with an email');
  }
  
  if (typeof order.total !== 'number' || order.total <= 0) {
    throw new Error('Order must have a positive total');
  }
  
  return true;
}
`;
          }
          
          // Add payment processing for payment commands
          if (component.name.includes('Payment')) {
            enhancedCode += `
// E-commerce payment processing
function processPayment(payment) {
  // Simulate payment processing
  return {
    success: true,
    transactionId: \`txn-\${Date.now()}\`,
    amount: payment.amount,
    method: payment.method,
    status: 'completed',
    createdAt: new Date().toISOString()
  };
}
`;
          }
          
          context.code = enhancedCode;
        }
        
        return context;
      },
      
      // Transformation hook
      [DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT]: (context: any) => {
        const { component, transformedComponent } = context;
        
        // Only process schema components
        if (component.type === ComponentType.SCHEMA) {
          // Add metadata to transformed component
          transformedComponent.metadata = {
            ...transformedComponent.metadata,
            domain: 'e-commerce',
            version: '1.0.0',
            generated: new Date().toISOString()
          };
          
          // Add validation rules for specific schemas
          if (component.name === 'Order') {
            transformedComponent.validationRules = [
              { rule: 'items.length > 0', message: 'Order must have at least one item' },
              { rule: 'total > 0', message: 'Order total must be positive' },
              { rule: 'customer.email', message: 'Order must have a customer with an email' }
            ];
          }
          
          if (component.name === 'Payment') {
            transformedComponent.validationRules = [
              { rule: 'amount > 0', message: 'Payment amount must be positive' },
              { rule: 'method', message: 'Payment must have a method' },
              { rule: 'orderId', message: 'Payment must be associated with an order' }
            ];
          }
        }
        
        return context;
      }
    }
  };
} 