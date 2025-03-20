import { 
  Component, 
  ComponentType, 
  SchemaComponent, 
  CommandComponent, 
  QueryComponent,
  EventComponent,
  WorkflowComponent,
  ExtensionComponent,
  PluginComponent
} from './types.js';

/**
 * Result of component validation
 */
export interface ValidationResult {
  /**
   * Whether the component is valid
   */
  isValid: boolean;

  /**
   * List of validation errors
   */
  errors: string[];
}

/**
 * Interface for component validators
 */
export interface ComponentValidator {
  /**
   * Validate a component
   * @param component The component to validate
   * @returns Validation result
   */
  validate(component: Component): ValidationResult;
}

/**
 * Base class for component validators
 */
abstract class BaseComponentValidator implements ComponentValidator {
  /**
   * Validate a component
   * @param component The component to validate
   * @returns Validation result
   */
  validate(component: Component): ValidationResult {
    const errors: string[] = [];
    
    // Validate common fields
    this.validateCommonFields(component, errors);
    
    // Validate specific fields
    this.validateSpecificFields(component, errors);
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate common fields that all components should have
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateCommonFields(component: Component, errors: string[]): void {
    if (!component.name) {
      errors.push('Component name is required');
    } else if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(component.name)) {
      errors.push('Component name must start with a letter and contain only alphanumeric characters');
    }
    
    if (component.version && !/^\d+\.\d+\.\d+$/.test(component.version)) {
      errors.push('Component version must be in semver format (e.g., 1.0.0)');
    }
  }
  
  /**
   * Validate fields specific to a component type
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected abstract validateSpecificFields(component: Component, errors: string[]): void;
}

/**
 * Validator for schema components
 */
export class SchemaComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to schema components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const schemaComponent = component as SchemaComponent;
    
    if (component.type !== ComponentType.SCHEMA) {
      errors.push(`Component type must be '${ComponentType.SCHEMA}', got '${component.type}'`);
      return;
    }
    
    if (!schemaComponent.definition) {
      errors.push('Schema definition is required');
      return;
    }
    
    if (!schemaComponent.definition.type) {
      errors.push('Schema definition must have a type');
    }
    
    if (schemaComponent.definition.type === 'object' && !schemaComponent.definition.properties) {
      errors.push('Object schema must have properties');
    }
  }
}

/**
 * Validator for command components
 */
export class CommandComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to command components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const commandComponent = component as CommandComponent;
    
    if (component.type !== ComponentType.COMMAND) {
      errors.push(`Component type must be '${ComponentType.COMMAND}', got '${component.type}'`);
      return;
    }
    
    if (!commandComponent.input) {
      errors.push('Command input is required');
    } else if (!commandComponent.input.ref) {
      errors.push('Command input must reference a schema');
    }
    
    if (!commandComponent.output) {
      errors.push('Command output is required');
    } else if (!commandComponent.output.ref) {
      errors.push('Command output must reference a schema');
    }
  }
}

/**
 * Validator for query components
 */
export class QueryComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to query components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const queryComponent = component as QueryComponent;
    
    if (component.type !== ComponentType.QUERY) {
      errors.push(`Component type must be '${ComponentType.QUERY}', got '${component.type}'`);
      return;
    }
    
    if (!queryComponent.input) {
      errors.push('Query input is required');
    } else if (!queryComponent.input.ref) {
      errors.push('Query input must reference a schema');
    }
    
    if (!queryComponent.output) {
      errors.push('Query output is required');
    } else if (!queryComponent.output.ref) {
      errors.push('Query output must reference a schema');
    }
  }
}

/**
 * Validator for event components
 */
export class EventComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to event components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const eventComponent = component as EventComponent;
    
    if (component.type !== ComponentType.EVENT) {
      errors.push(`Component type must be '${ComponentType.EVENT}', got '${component.type}'`);
      return;
    }
    
    if (!eventComponent.payload) {
      errors.push('Event payload is required');
    } else if (!eventComponent.payload.ref) {
      errors.push('Event payload must reference a schema');
    }
  }
}

/**
 * Validator for workflow components
 */
export class WorkflowComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to workflow components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const workflowComponent = component as WorkflowComponent;
    
    if (component.type !== ComponentType.WORKFLOW) {
      errors.push(`Component type must be '${ComponentType.WORKFLOW}', got '${component.type}'`);
      return;
    }
    
    if (!workflowComponent.steps || workflowComponent.steps.length === 0) {
      errors.push('Workflow must have at least one step');
      return;
    }
    
    // Validate each step
    workflowComponent.steps.forEach((step, index) => {
      if (!step.name) {
        errors.push(`Step ${index + 1} must have a name`);
      }
      
      if (!step.command) {
        errors.push(`Step ${index + 1} must have a command`);
      }
    });
  }
}

/**
 * Validator for extension components
 */
export class ExtensionComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to extension components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const extensionComponent = component as ExtensionComponent;
    
    if (component.type !== ComponentType.EXTENSION) {
      errors.push(`Component type must be '${ComponentType.EXTENSION}', got '${component.type}'`);
      return;
    }
    
    if (!extensionComponent.hooks || Object.keys(extensionComponent.hooks).length === 0) {
      errors.push('Extension must have at least one hook');
    }
  }
}

/**
 * Validator for plugin components
 */
export class PluginComponentValidator extends BaseComponentValidator {
  /**
   * Validate fields specific to plugin components
   * @param component The component to validate
   * @param errors List of errors to append to
   */
  protected validateSpecificFields(component: Component, errors: string[]): void {
    const pluginComponent = component as PluginComponent;
    
    if (component.type !== ComponentType.PLUGIN) {
      errors.push(`Component type must be '${ComponentType.PLUGIN}', got '${component.type}'`);
      return;
    }
    
    if (!pluginComponent.operations || pluginComponent.operations.length === 0) {
      errors.push('Plugin must have at least one operation');
      return;
    }
    
    // Validate each operation
    pluginComponent.operations.forEach((operation, index) => {
      if (!operation.name) {
        errors.push(`Operation ${index + 1} must have a name`);
      }
      
      if (!operation.description) {
        errors.push(`Operation ${index + 1} must have a description`);
      }
    });
  }
}

/**
 * Factory for creating component validators
 */
export class ComponentValidatorFactory {
  private validators: Record<ComponentType, ComponentValidator> = {} as Record<ComponentType, ComponentValidator>;
  
  /**
   * Constructor
   */
  constructor() {
    // Register default validators
    this.registerValidator(ComponentType.SCHEMA, new SchemaComponentValidator());
    this.registerValidator(ComponentType.COMMAND, new CommandComponentValidator());
    this.registerValidator(ComponentType.QUERY, new QueryComponentValidator());
    this.registerValidator(ComponentType.EVENT, new EventComponentValidator());
    this.registerValidator(ComponentType.WORKFLOW, new WorkflowComponentValidator());
    this.registerValidator(ComponentType.EXTENSION, new ExtensionComponentValidator());
    this.registerValidator(ComponentType.PLUGIN, new PluginComponentValidator());
  }
  
  /**
   * Register a validator for a component type
   * @param type Component type
   * @param validator Validator instance
   */
  registerValidator(type: ComponentType, validator: ComponentValidator): void {
    this.validators[type] = validator;
  }
  
  /**
   * Get a validator for a component type
   * @param type Component type
   * @returns Validator instance
   */
  getValidator(type: ComponentType): ComponentValidator {
    const validator = this.validators[type];
    if (!validator) {
      throw new Error(`No validator registered for component type: ${type}`);
    }
    return validator;
  }
  
  /**
   * Validate a component
   * @param component Component to validate
   * @returns Validation result
   */
  validate(component: Component): ValidationResult {
    try {
      const validator = this.getValidator(component.type);
      return validator.validate(component);
    } catch (error) {
      return {
        isValid: false,
        errors: [(error as Error).message]
      };
    }
  }
}

// Create a singleton instance
export const componentValidatorFactory = new ComponentValidatorFactory(); 