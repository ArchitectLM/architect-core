/**
 * Parameterized Pattern Library
 * 
 * This module provides an enhanced pattern library with parameterization capabilities,
 * allowing patterns to be customized with parameters and composed together.
 */

/**
 * Parameter definition for a pattern
 */
export interface PatternParameter {
  /**
   * Name of the parameter
   */
  name: string;
  
  /**
   * Type of the parameter
   */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  
  /**
   * Description of the parameter
   */
  description: string;
  
  /**
   * Whether the parameter is required
   */
  required: boolean;
  
  /**
   * Default value for the parameter
   */
  defaultValue?: any;
  
  /**
   * Validation function for the parameter
   */
  validation?: (value: any) => boolean;
}

/**
 * Example of a pattern application
 */
export interface PatternExample {
  /**
   * Description of the example
   */
  description: string;
  
  /**
   * Parameters used in the example
   */
  parameters: Record<string, any>;
  
  /**
   * Result of applying the pattern with the parameters
   */
  result: string;
}

/**
 * Parameterized pattern definition
 */
export interface ParameterizedPattern {
  /**
   * Unique identifier for the pattern
   */
  id: string;
  
  /**
   * Name of the pattern
   */
  name: string;
  
  /**
   * Description of the pattern
   */
  description: string;
  
  /**
   * Category of the pattern
   */
  category: string;
  
  /**
   * Parameters for the pattern
   */
  parameters: PatternParameter[];
  
  /**
   * Template for the pattern
   * Can be a string with parameter placeholders or a function that generates the result
   */
  template: string | ((params: Record<string, any>) => string);
  
  /**
   * Examples of the pattern in use
   */
  examples: PatternExample[];
  
  /**
   * For composed patterns, the component patterns
   */
  components?: Array<{
    id: string;
    parameters: Record<string, any>;
  }>;
}

/**
 * Pattern library for managing and applying parameterized patterns
 */
export class PatternLibrary {
  /**
   * Map of pattern ID to pattern definition
   */
  private patterns: Record<string, ParameterizedPattern> = {};
  
  /**
   * Registers a pattern with the library
   * @param pattern The pattern to register
   */
  registerPattern(pattern: ParameterizedPattern): void {
    this.patterns[pattern.id] = pattern;
  }
  
  /**
   * Gets a pattern by ID
   * @param id The ID of the pattern to get
   * @returns The pattern, or undefined if not found
   */
  getPattern(id: string): ParameterizedPattern | undefined {
    return this.patterns[id];
  }
  
  /**
   * Applies a pattern with the given parameters
   * @param id The ID of the pattern to apply
   * @param parameters The parameters to apply the pattern with
   * @returns The result of applying the pattern
   * @throws If the pattern is not found or parameters are invalid
   */
  applyPattern(id: string, parameters: Record<string, any>): string {
    const pattern = this.getPattern(id);
    if (!pattern) {
      throw new Error(`Pattern not found: ${id}`);
    }
    
    // Validate parameters and apply defaults
    const validatedParams = this.validateAndApplyDefaults(pattern, parameters);
    
    // If it's a composed pattern, apply each component pattern
    if (pattern.components) {
      return this.applyComposedPattern(pattern);
    }
    
    // Apply the pattern
    if (typeof pattern.template === 'function') {
      return pattern.template(validatedParams);
    }
    
    // Simple string template with variable substitution
    return this.substituteParameters(pattern.template, validatedParams);
  }
  
  /**
   * Composes multiple patterns into a single pattern
   * @param components The component patterns to compose
   * @returns The composed pattern
   */
  composePatterns(components: Array<{
    id: string;
    parameters: Record<string, any>;
  }>): ParameterizedPattern {
    // Validate that all component patterns exist
    for (const component of components) {
      if (!this.getPattern(component.id)) {
        throw new Error(`Pattern not found: ${component.id}`);
      }
    }
    
    // Create a unique ID for the composed pattern
    const composedId = `composed-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create the composed pattern
    const composedPattern: ParameterizedPattern = {
      id: composedId,
      name: 'Composed Pattern',
      description: 'A pattern composed of multiple patterns',
      category: 'composed',
      parameters: [],
      template: '',
      examples: [],
      components
    };
    
    // Define the template function for the composed pattern
    composedPattern.template = () => {
      // Apply each component pattern and combine the results
      const results = components.map(component => {
        const pattern = this.getPattern(component.id)!;
        const result = this.applyPattern(component.id, component.parameters);
        return result;
      });
      
      // Combine the results into a single JSON object
      return `{
        "composedPattern": {
          "id": "${composedId}",
          "name": "Composed Pattern",
          "components": [
            ${results.join(',\n')}
          ]
        }
      }`;
    };
    
    return composedPattern;
  }
  
  /**
   * Validates parameters and applies default values
   * @param pattern The pattern to validate parameters for
   * @param parameters The parameters to validate
   * @returns The validated parameters with defaults applied
   * @throws If parameters are invalid
   * @private
   */
  private validateAndApplyDefaults(
    pattern: ParameterizedPattern,
    parameters: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = { ...parameters };
    
    // Check required parameters and apply defaults
    for (const param of pattern.parameters) {
      // Check if required parameter is missing
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
      
      // Apply default value if parameter is missing
      if (!(param.name in parameters) && param.defaultValue !== undefined) {
        result[param.name] = param.defaultValue;
      }
      
      // Validate parameter value if present
      if (param.name in result && param.validation) {
        if (!param.validation(result[param.name])) {
          throw new Error(`Invalid value for parameter: ${param.name}`);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Substitutes parameters in a string template
   * @param template The template string
   * @param parameters The parameters to substitute
   * @returns The template with parameters substituted
   * @private
   */
  private substituteParameters(template: string, parameters: Record<string, any>): string {
    return template.replace(/\${(\w+)}/g, (_, name) => {
      return parameters[name] !== undefined ? String(parameters[name]) : `\${${name}}`;
    });
  }
  
  /**
   * Applies a composed pattern
   * @param pattern The composed pattern to apply
   * @returns The result of applying the composed pattern
   * @private
   */
  private applyComposedPattern(pattern: ParameterizedPattern): string {
    if (!pattern.components) {
      throw new Error('Not a composed pattern');
    }
    
    // Apply each component pattern and combine the results
    const results = pattern.components.map(component => {
      const componentPattern = this.getPattern(component.id)!;
      const result = this.applyPattern(component.id, component.parameters);
      return result;
    });
    
    // Combine the results into a single JSON object
    return `{
      "composedPattern": {
        "id": "${pattern.id}",
        "name": "${pattern.name}",
        "components": [
          ${results.join(',\n')}
        ]
      }
    }`;
  }
} 