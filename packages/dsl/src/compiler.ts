/**
 * DSL Compiler
 * 
 * This module provides functionality to compile DSL configurations into executable code
 * or interpret them at runtime.
 */

import { Component, ComponentType, SystemDefinition } from './types.js';
import { componentValidatorFactory } from './component-validation.js';

/**
 * Compilation options
 */
export interface CompilationOptions {
  /**
   * Target language for code generation
   */
  targetLanguage?: 'typescript' | 'javascript';

  /**
   * Whether to validate components before compilation
   */
  validateComponents?: boolean;

  /**
   * Whether to generate type definitions
   */
  generateTypes?: boolean;

  /**
   * Output directory for generated code
   */
  outputDir?: string;

  /**
   * Custom transformers for specific component types
   */
  transformers?: Partial<Record<ComponentType, ComponentTransformer>>;
}

/**
 * Default compilation options
 */
export const DEFAULT_COMPILATION_OPTIONS: CompilationOptions = {
  targetLanguage: 'typescript',
  validateComponents: true,
  generateTypes: true,
  outputDir: './generated',
};

/**
 * Component transformer interface
 */
export interface ComponentTransformer {
  /**
   * Transform a component into code
   */
  transform(component: Component, options: CompilationOptions): string;
}

/**
 * Schema component transformer
 */
export class SchemaComponentTransformer implements ComponentTransformer {
  transform(component: Component, options: CompilationOptions): string {
    if (component.type !== ComponentType.SCHEMA) {
      throw new Error(`Expected schema component, got ${component.type}`);
    }

    const { name, definition } = component;
    
    if (options.targetLanguage === 'typescript') {
      // Generate TypeScript interface
      let code = `/**\n * ${component.description || `${name} schema`}\n */\n`;
      code += `export interface ${name} {\n`;
      
      // Add properties
      if (definition.properties) {
        for (const [propName, propDef] of Object.entries(definition.properties)) {
          const isRequired = definition.required?.includes(propName) ?? false;
          const propType = this.mapJsonSchemaTypeToTs(propDef);
          const optionalMark = isRequired ? '' : '?';
          
          code += `  /**\n   * ${propDef.description || propName}\n   */\n`;
          code += `  ${propName}${optionalMark}: ${propType};\n\n`;
        }
      }
      
      code += '}\n';
      return code;
    } else {
      // Generate JavaScript class with validation
      let code = `/**\n * ${component.description || `${name} schema`}\n */\n`;
      code += `export class ${name} {\n`;
      
      // Add properties
      if (definition.properties) {
        for (const [propName, propDef] of Object.entries(definition.properties)) {
          code += `  /**\n   * ${propDef.description || propName}\n   */\n`;
          code += `  ${propName};\n\n`;
        }
      }
      
      // Add constructor
      code += '  /**\n   * Constructor\n   */\n';
      code += '  constructor(data) {\n';
      code += '    if (data) {\n';
      
      if (definition.properties) {
        for (const propName of Object.keys(definition.properties)) {
          code += `      this.${propName} = data.${propName};\n`;
        }
      }
      
      code += '    }\n';
      code += '  }\n\n';
      
      // Add validation method
      code += '  /**\n   * Validate the object\n   */\n';
      code += '  validate() {\n';
      code += '    const errors = [];\n';
      
      if (definition.required) {
        for (const requiredProp of definition.required) {
          code += `    if (this.${requiredProp} === undefined || this.${requiredProp} === null) {\n`;
          code += `      errors.push(\`${requiredProp} is required\`);\n`;
          code += '    }\n';
        }
      }
      
      if (definition.properties) {
        for (const [propName, propDef] of Object.entries(definition.properties)) {
          if (propDef.type === 'string' && propDef.pattern) {
            code += `    if (this.${propName} && !new RegExp('${propDef.pattern}').test(this.${propName})) {\n`;
            code += `      errors.push(\`${propName} must match pattern: ${propDef.pattern}\`);\n`;
            code += '    }\n';
          }
          
          if (propDef.type === 'number' || propDef.type === 'integer') {
            if (propDef.minimum !== undefined) {
              code += `    if (this.${propName} !== undefined && this.${propName} < ${propDef.minimum}) {\n`;
              code += `      errors.push(\`${propName} must be at least ${propDef.minimum}\`);\n`;
              code += '    }\n';
            }
            
            if (propDef.maximum !== undefined) {
              code += `    if (this.${propName} !== undefined && this.${propName} > ${propDef.maximum}) {\n`;
              code += `      errors.push(\`${propName} must be at most ${propDef.maximum}\`);\n`;
              code += '    }\n';
            }
          }
        }
      }
      
      code += '    return {\n';
      code += '      isValid: errors.length === 0,\n';
      code += '      errors\n';
      code += '    };\n';
      code += '  }\n';
      code += '}\n';
      
      return code;
    }
  }
  
  /**
   * Map JSON Schema type to TypeScript type
   */
  private mapJsonSchemaTypeToTs(propDef: any): string {
    const type = propDef.type;
    
    switch (type) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        if (propDef.items) {
          const itemType = this.mapJsonSchemaTypeToTs(propDef.items);
          return `${itemType}[]`;
        }
        return 'any[]';
      case 'object':
        if (propDef.properties) {
          let objType = '{\n';
          for (const [subPropName, subPropDef] of Object.entries(propDef.properties)) {
            const isRequired = propDef.required?.includes(subPropName) ?? false;
            const subPropType = this.mapJsonSchemaTypeToTs(subPropDef);
            const optionalMark = isRequired ? '' : '?';
            
            objType += `    ${subPropName}${optionalMark}: ${subPropType};\n`;
          }
          objType += '  }';
          return objType;
        }
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }
}

/**
 * Command component transformer
 */
export class CommandComponentTransformer implements ComponentTransformer {
  transform(component: Component, options: CompilationOptions): string {
    if (component.type !== ComponentType.COMMAND) {
      throw new Error(`Expected command component, got ${component.type}`);
    }

    const { name, input, output } = component;
    
    if (options.targetLanguage === 'typescript') {
      // Generate TypeScript function
      let code = `/**\n * ${component.description || `${name} command`}\n`;
      code += ` * @param input Input of type ${input.ref}\n`;
      code += ` * @returns Output of type ${output.ref}\n`;
      code += ` */\n`;
      code += `export async function ${name}(input: ${input.ref}): Promise<${output.ref}> {\n`;
      code += '  // TODO: Implement command logic\n';
      code += '  throw new Error("Not implemented");\n';
      code += '}\n';
      
      return code;
    } else {
      // Generate JavaScript function
      let code = `/**\n * ${component.description || `${name} command`}\n`;
      code += ` * @param {Object} input Input of type ${input.ref}\n`;
      code += ` * @returns {Promise<Object>} Output of type ${output.ref}\n`;
      code += ` */\n`;
      code += `export async function ${name}(input) {\n`;
      code += '  // TODO: Implement command logic\n';
      code += '  throw new Error("Not implemented");\n';
      code += '}\n';
      
      return code;
    }
  }
}

/**
 * DSL Compiler
 */
export class DSLCompiler {
  private transformers: Record<ComponentType, ComponentTransformer> = {} as Record<ComponentType, ComponentTransformer>;
  
  /**
   * Constructor
   */
  constructor() {
    // Register default transformers
    this.registerTransformer(ComponentType.SCHEMA, new SchemaComponentTransformer());
    this.registerTransformer(ComponentType.COMMAND, new CommandComponentTransformer());
  }
  
  /**
   * Register a transformer for a component type
   */
  registerTransformer(type: ComponentType, transformer: ComponentTransformer): void {
    this.transformers[type] = transformer;
  }
  
  /**
   * Get a transformer for a component type
   */
  getTransformer(type: ComponentType): ComponentTransformer {
    const transformer = this.transformers[type];
    if (!transformer) {
      throw new Error(`No transformer registered for component type: ${type}`);
    }
    return transformer;
  }
  
  /**
   * Compile a component
   */
  compileComponent(component: Component, options: CompilationOptions = DEFAULT_COMPILATION_OPTIONS): string {
    // Validate component if required
    if (options.validateComponents) {
      const validationResult = componentValidatorFactory.validate(component);
      if (!validationResult.isValid) {
        throw new Error(`Invalid component: ${validationResult.errors.join(', ')}`);
      }
    }
    
    // Use custom transformer if provided
    if (options.transformers?.[component.type]) {
      return options.transformers[component.type]!.transform(component, options);
    }
    
    // Use default transformer
    try {
      const transformer = this.getTransformer(component.type);
      return transformer.transform(component, options);
    } catch (error) {
      throw new Error(`Failed to compile component ${component.name}: ${(error as Error).message}`);
    }
  }
  
  /**
   * Compile a system definition
   */
  compileSystem(system: SystemDefinition, options: CompilationOptions = DEFAULT_COMPILATION_OPTIONS): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Compile components
    const compileComponents = (components: Component[]) => {
      for (const component of components) {
        try {
          const code = this.compileComponent(component, options);
          result[`${component.name}.${options.targetLanguage === 'typescript' ? 'ts' : 'js'}`] = code;
        } catch (error) {
          console.error(`Error compiling component ${component.name}:`, error);
        }
      }
    };
    
    // TODO: Implement system compilation
    
    return result;
  }
}

// Create a singleton instance
export const dslCompiler = new DSLCompiler(); 