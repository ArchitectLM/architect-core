import { DSLPlugin } from '../../src/dsl-plugin-system.js';
import { BaseComponent, ComponentType } from '../../src/types.js';

/**
 * Creates an e-commerce plugin for the DSL
 */
export function createEcommercePlugin(): DSLPlugin {
  return {
    name: 'ecommerce-plugin',
    version: '1.0.0',
    description: 'Plugin for e-commerce DSL',
    supportedComponentTypes: [
      ComponentType.SCHEMA,
      ComponentType.COMMAND,
      ComponentType.EVENT
    ],
    hooks: {},
    extensions: [],
    interceptors: [],
    
    /**
     * Validates e-commerce components
     */
    onComponentValidation: (
      component: BaseComponent,
      validationResult: { isValid: boolean; errors: string[] }
    ) => {
      const errors = [...validationResult.errors];
      
      // Validate schemas
      if (component.type === ComponentType.SCHEMA) {
        // Validate Order schema
        if (component.name === 'Order') {
          const definition = component.definition;
          
          // Check if the order has items property
          if (!definition.properties?.items) {
            errors.push('Order schema must have an items property');
          }
          
          // Check if the order has a total property
          if (!definition.properties?.total) {
            errors.push('Order schema must have a total property');
          }
          
          // Check if the order has a customer property
          if (!definition.properties?.customer) {
            errors.push('Order schema must have a customer property');
          }
        }
        
        // Validate Payment schema
        if (component.name === 'Payment') {
          const definition = component.definition;
          
          // Check if the payment has an amount property
          if (!definition.properties?.amount) {
            errors.push('Payment schema must have an amount property');
          }
          
          // Check if the payment has a method property
          if (!definition.properties?.method) {
            errors.push('Payment schema must have a method property');
          }
        }
      }
      
      // Validate commands
      if (component.type === ComponentType.COMMAND) {
        // All commands should have input and output
        if (!component.input) {
          errors.push(`Command ${component.name} must have an input`);
        }
        
        if (!component.output) {
          errors.push(`Command ${component.name} must have an output`);
        }
      }
      
      // Validate events
      if (component.type === ComponentType.EVENT) {
        // All events should have a payload
        if (!component.payload) {
          errors.push(`Event ${component.name} must have a payload`);
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    },
    
    /**
     * Adds JSDoc comments to compiled components
     */
    onComponentCompilation: (component: BaseComponent, code: string) => {
      // Add JSDoc comments to the code
      let modifiedCode = `/**\n`;
      modifiedCode += ` * ${component.name}\n`;
      
      if (component.description) {
        modifiedCode += ` * \n`;
        modifiedCode += ` * ${component.description}\n`;
      }
      
      // Add component type
      modifiedCode += ` * \n`;
      modifiedCode += ` * Component Type: ${component.type}\n`;
      
      // Add e-commerce specific comments
      if (component.type === ComponentType.SCHEMA) {
        modifiedCode += ` * \n`;
        modifiedCode += ` * E-Commerce Schema: This schema is part of the e-commerce domain model\n`;
      } else if (component.type === ComponentType.COMMAND) {
        modifiedCode += ` * \n`;
        modifiedCode += ` * E-Commerce Command: This command is used to perform operations in the e-commerce domain\n`;
        
        if (component.input) {
          modifiedCode += ` * Input: ${typeof component.input === 'object' && 'ref' in component.input ? component.input.ref : 'Custom type'}\n`;
        }
        
        if (component.output) {
          modifiedCode += ` * Output: ${typeof component.output === 'object' && 'ref' in component.output ? component.output.ref : 'Custom type'}\n`;
        }
      } else if (component.type === ComponentType.EVENT) {
        modifiedCode += ` * \n`;
        modifiedCode += ` * E-Commerce Event: This event is emitted when something happens in the e-commerce domain\n`;
        
        if (component.payload) {
          modifiedCode += ` * Payload: ${typeof component.payload === 'object' && 'ref' in component.payload ? component.payload.ref : 'Custom type'}\n`;
        }
      }
      
      modifiedCode += ` */\n`;
      modifiedCode += code;
      
      return modifiedCode;
    },
    
    /**
     * Logs when components are registered
     */
    onComponentRegistration: (component: BaseComponent) => {
      console.log(`[E-Commerce Plugin] Registered component: ${component.name} (${component.type})`);
    }
  };
} 