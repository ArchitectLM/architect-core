/**
 * Schema Validation Plugin
 * 
 * This plugin provides enhanced validation for schema components.
 */

import { DSLPlugin } from '../dsl-plugin-system.js';
import { BaseComponent, ComponentType, SchemaComponent } from '../types.js';

/**
 * Schema property definition
 */
interface SchemaPropertyDefinition {
  type: string;
  description?: string;
  [key: string]: any;
}

/**
 * Schema definition
 */
interface SchemaDefinition {
  title?: string;
  description?: string;
  type: string;
  properties?: Record<string, SchemaPropertyDefinition>;
  required?: string[];
  [key: string]: any;
}

/**
 * Schema validation plugin
 */
export const schemaValidationPlugin: DSLPlugin = {
  name: 'schema-validation-plugin',
  version: '1.0.0',
  description: 'Provides enhanced validation for schema components',
  supportedComponentTypes: [ComponentType.SCHEMA],
  hooks: {},
  
  /**
   * Validates a schema component
   * @param component The component to validate
   * @param validationResult The initial validation result
   * @returns The modified validation result
   */
  onComponentValidation: (
    component: BaseComponent,
    validationResult: { isValid: boolean; errors: string[] }
  ) => {
    // Only process schema components
    if (component.type !== ComponentType.SCHEMA) {
      return validationResult;
    }
    
    const errors = [...validationResult.errors];
    const schemaComponent = component as SchemaComponent;
    const schema = schemaComponent.definition as SchemaDefinition;
    
    // Check if the schema has a title
    if (!schema.title) {
      errors.push('Schema should have a title property');
    }
    
    // Check if the schema has a description
    if (!schema.description) {
      errors.push('Schema should have a description property');
    }
    
    // Check if required properties are defined
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!schema.properties || !schema.properties[requiredProp]) {
          errors.push(`Required property '${requiredProp}' is not defined in properties`);
        }
      }
    }
    
    // Check property types
    if (schema.properties) {
      for (const [propName, propDef] of Object.entries(schema.properties)) {
        if (!propDef.type) {
          errors.push(`Property '${propName}' should have a type`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Adds JSDoc comments to the compiled schema
   * @param component The component being compiled
   * @param code The generated code
   * @returns The modified code
   */
  onComponentCompilation: (component: BaseComponent, code: string) => {
    // Only process schema components
    if (component.type !== ComponentType.SCHEMA) {
      return code;
    }
    
    const schemaComponent = component as SchemaComponent;
    const schema = schemaComponent.definition as SchemaDefinition;
    
    // Add JSDoc comments to the code
    let modifiedCode = `/**\n`;
    modifiedCode += ` * ${component.name}\n`;
    
    if (schema.description) {
      modifiedCode += ` * \n`;
      modifiedCode += ` * ${schema.description}\n`;
    }
    
    if (schema.properties) {
      modifiedCode += ` * \n`;
      modifiedCode += ` * Properties:\n`;
      
      for (const [propName, propDef] of Object.entries(schema.properties)) {
        const required = schema.required && schema.required.includes(propName) ? 'required' : 'optional';
        modifiedCode += ` * - ${propName} (${propDef.type}, ${required}): ${propDef.description || 'No description'}\n`;
      }
    }
    
    modifiedCode += ` */\n`;
    modifiedCode += code;
    
    return modifiedCode;
  }
}; 