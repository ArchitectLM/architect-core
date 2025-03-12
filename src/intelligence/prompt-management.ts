/**
 * Prompt Management System
 * 
 * This module provides functionality for managing and rendering prompt templates
 * with versioning support.
 */

/**
 * Parameter definition for prompt templates
 */
export interface PromptParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  examples?: any[];
}

/**
 * Example for a prompt template
 */
export interface PromptExample {
  parameters: Record<string, any>;
  expectedOutput: string | Record<string, any>;
  description?: string;
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  template: string;
  parameters: Record<string, PromptParameter>;
  examples?: PromptExample[];
  metadata?: Record<string, any>;
}

/**
 * Registry for prompt templates with versioning support
 */
export class PromptRegistry {
  private templates: Map<string, Map<string, PromptTemplate>> = new Map();
  
  /**
   * Register a prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    if (!this.templates.has(template.id)) {
      this.templates.set(template.id, new Map());
    }
    
    this.templates.get(template.id)!.set(template.version, template);
  }
  
  /**
   * Get a prompt template by ID and optional version
   * If no version is specified, returns the latest version
   */
  getTemplate(id: string, version?: string): PromptTemplate | undefined {
    const templateVersions = this.templates.get(id);
    if (!templateVersions) return undefined;
    
    if (version) {
      return templateVersions.get(version);
    }
    
    // Return latest version if no specific version requested
    const versions = Array.from(templateVersions.keys())
      .sort((a, b) => this.compareVersions(b, a));
    
    return versions.length > 0 ? templateVersions.get(versions[0]) : undefined;
  }
  
  /**
   * Get all templates
   */
  getAllTemplates(): PromptTemplate[] {
    const allTemplates: PromptTemplate[] = [];
    
    this.templates.forEach(versionMap => {
      versionMap.forEach(template => {
        allTemplates.push(template);
      });
    });
    
    return allTemplates;
  }
  
  /**
   * Get all versions of a template
   */
  getTemplateVersions(id: string): PromptTemplate[] {
    const templateVersions = this.templates.get(id);
    if (!templateVersions) return [];
    
    return Array.from(templateVersions.values());
  }
  
  /**
   * Compare two semantic version strings
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = i < aParts.length ? aParts[i] : 0;
      const bVal = i < bParts.length ? bParts[i] : 0;
      
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    
    return 0;
  }
}

/**
 * Render a prompt template with parameters
 */
export function renderPrompt(
  template: PromptTemplate, 
  parameters: Record<string, any>
): string {
  // Validate parameters
  const missingParams: string[] = [];
  
  Object.entries(template.parameters).forEach(([key, spec]) => {
    if (spec.required && !(key in parameters)) {
      missingParams.push(key);
    }
  });
  
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }
  
  // Apply default values for optional parameters
  const allParams = { ...parameters };
  
  Object.entries(template.parameters).forEach(([key, spec]) => {
    if (!spec.required && !(key in parameters) && 'defaultValue' in spec) {
      allParams[key] = spec.defaultValue;
    }
  });
  
  // Render template with parameters
  let result = template.template;
  
  // Replace {{param}} style parameters
  Object.entries(allParams).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  });
  
  return result;
}

/**
 * Common prompt templates for reactive systems
 */
export const commonPromptTemplates: PromptTemplate[] = [
  {
    id: 'system-definition',
    version: '1.0.0',
    name: 'System Definition',
    description: 'Generates a complete reactive system definition',
    template: `
You are an expert system designer. Create a complete reactive system definition for a {{domain}} application.

The system should include:
- Bounded contexts for key domain areas
- Core processes for main workflows
- Tasks for individual operations
- Flows connecting processes together

Additional requirements:
{{requirements}}

Please provide the complete system definition in JSON format following the ReactiveSystem schema.
    `,
    parameters: {
      domain: {
        type: 'string',
        description: 'The domain for the system (e.g., e-commerce, healthcare)',
        required: true,
        examples: ['e-commerce', 'healthcare', 'finance']
      },
      requirements: {
        type: 'string',
        description: 'Additional requirements for the system',
        required: false,
        defaultValue: 'No additional requirements.'
      }
    },
    examples: [
      {
        parameters: {
          domain: 'e-commerce',
          requirements: 'Include order processing and inventory management.'
        },
        expectedOutput: {
          id: 'ecommerce-system',
          name: 'E-commerce System',
          version: '1.0.0',
          boundedContexts: {
            /* Example bounded contexts */
          },
          processes: {
            /* Example processes */
          }
        }
      }
    ]
  },
  {
    id: 'process-definition',
    version: '1.0.0',
    name: 'Process Definition',
    description: 'Generates a process definition for a specific domain',
    template: `
You are an expert process designer. Create a detailed process definition for a {{processType}} process in the {{domain}} domain.

The process should include:
- Clear states and transitions (if stateful)
- Well-defined tasks
- Appropriate error handling

Process requirements:
{{requirements}}

Please provide the complete process definition in JSON format following the Process schema.
    `,
    parameters: {
      domain: {
        type: 'string',
        description: 'The domain for the process',
        required: true
      },
      processType: {
        type: 'string',
        description: 'The type of process to generate',
        required: true,
        examples: ['order-fulfillment', 'payment-processing', 'user-registration']
      },
      requirements: {
        type: 'string',
        description: 'Specific requirements for the process',
        required: false,
        defaultValue: 'No specific requirements.'
      }
    }
  }
];

/**
 * Create and initialize a prompt registry with common templates
 */
export function createPromptRegistry(): PromptRegistry {
  const registry = new PromptRegistry();
  
  // Register common prompt templates
  commonPromptTemplates.forEach(template => {
    registry.registerTemplate(template);
  });
  
  return registry;
} 