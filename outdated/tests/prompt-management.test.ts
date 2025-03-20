import { describe, it, expect } from 'vitest';

// Define interfaces and mock classes for testing
interface PromptTemplateVersion {
  version: string;
  template: string;
  variables: string[];
  metadata: Record<string, any>;
}

interface PromptTemplateConfig {
  id: string;
  name: string;
  description: string;
  versions: PromptTemplateVersion[];
}

interface PromptRenderOptions {
  version?: string;
  variables: Record<string, any>;
}

// Mock implementation of PromptTemplate
class PromptTemplate {
  id: string;
  name: string;
  description: string;
  versions: PromptTemplateVersion[];

  constructor(config: PromptTemplateConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.versions = [...config.versions];
  }

  getVersion(version: string): PromptTemplateVersion | undefined {
    return this.versions.find(v => v.version === version);
  }

  getLatestVersion(pattern?: string): PromptTemplateVersion {
    if (!pattern) {
      // Sort versions semantically and return the latest
      return this.versions.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
          if (aParts[i] > bParts[i]) return -1;
          if (aParts[i] < bParts[i]) return 1;
        }
        
        return 0;
      })[0];
    }

    // Handle pattern matching (e.g., '1.x', '1.1.x')
    const patternParts = pattern.split('.');
    const matchingVersions = this.versions.filter(v => {
      const vParts = v.version.split('.');
      
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i] === 'x') continue;
        if (vParts[i] !== patternParts[i]) return false;
      }
      
      return true;
    });

    return matchingVersions.sort((a, b) => {
      const aParts = a.version.split('.').map(Number);
      const bParts = b.version.split('.').map(Number);
      
      for (let i = 0; i < 3; i++) {
        if (aParts[i] > bParts[i]) return -1;
        if (aParts[i] < bParts[i]) return 1;
      }
      
      return 0;
    })[0];
  }

  addVersion(version: PromptTemplateVersion): void {
    this.versions.push(version);
  }
}

// Mock implementation of PromptManager
class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();

  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  renderPrompt(templateId: string, options: PromptRenderOptions): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const version = options.version 
      ? template.getVersion(options.version) 
      : template.getLatestVersion();
    
    if (!version) {
      throw new Error(`Version not found: ${options.version}`);
    }

    // Check for missing variables
    for (const variable of version.variables) {
      if (!(variable in options.variables) && !variable.includes('.')) {
        throw new Error(`Missing required variable: ${variable}`);
      }
    }

    // Simple template rendering with variable substitution
    let rendered = version.template;
    
    // Handle conditional sections
    rendered = this.renderConditionals(rendered, options.variables);
    
    // Handle loops
    rendered = this.renderLoops(rendered, options.variables);
    
    // Handle variables
    for (const [key, value] of Object.entries(options.variables)) {
      if (typeof value !== 'object' || value === null) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
    }
    
    return rendered;
  }

  private renderConditionals(template: string, variables: Record<string, any>): string {
    // Simple implementation of conditional rendering
    const conditionalRegex = /{{#if (\w+)}}(.*?){{\/if}}/gs;
    
    return template.replace(conditionalRegex, (_, condition, content) => {
      return variables[condition] ? content : '';
    });
  }

  private renderLoops(template: string, variables: Record<string, any>): string {
    // Simple implementation of loop rendering
    const loopRegex = /{{#each (\w+)}}(.*?){{\/each}}/gs;
    
    return template.replace(loopRegex, (_, arrayName, content) => {
      if (!Array.isArray(variables[arrayName])) {
        return '';
      }
      
      return variables[arrayName].map((item: any) => {
        let itemContent = content;
        
        // Replace item properties
        for (const [key, value] of Object.entries(item)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemContent = itemContent.replace(regex, String(value));
        }
        
        return itemContent;
      }).join('');
    });
  }
}

describe('Prompt Management System', () => {
  describe('PromptTemplate', () => {
    it('should create a prompt template with versions', () => {
      const template = new PromptTemplate({
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt template',
        versions: [
          {
            version: '1.0.0',
            template: 'This is version 1.0.0 of the prompt with {{variable}}',
            variables: ['variable'],
            metadata: {
              model: 'gpt-3.5-turbo',
              temperature: 0.7
            }
          },
          {
            version: '1.1.0',
            template: 'This is version 1.1.0 of the prompt with {{variable}} and {{newVariable}}',
            variables: ['variable', 'newVariable'],
            metadata: {
              model: 'gpt-4',
              temperature: 0.5
            }
          }
        ]
      });

      expect(template.id).toBe('test-prompt');
      expect(template.name).toBe('Test Prompt');
      expect(template.versions.length).toBe(2);
      expect(template.getLatestVersion().version).toBe('1.1.0');
    });

    it('should get a specific version of a template', () => {
      const template = new PromptTemplate({
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt template',
        versions: [
          {
            version: '1.0.0',
            template: 'This is version 1.0.0',
            variables: [],
            metadata: {}
          },
          {
            version: '1.1.0',
            template: 'This is version 1.1.0',
            variables: [],
            metadata: {}
          }
        ]
      });

      const v1 = template.getVersion('1.0.0');
      expect(v1).toBeDefined();
      expect(v1?.version).toBe('1.0.0');
      expect(v1?.template).toBe('This is version 1.0.0');

      const v2 = template.getVersion('1.1.0');
      expect(v2).toBeDefined();
      expect(v2?.version).toBe('1.1.0');
      expect(v2?.template).toBe('This is version 1.1.0');

      const nonExistent = template.getVersion('2.0.0');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('PromptManager', () => {
    it('should register and retrieve prompt templates', () => {
      const manager = new PromptManager();
      
      const template = new PromptTemplate({
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt template',
        versions: [
          {
            version: '1.0.0',
            template: 'This is a test prompt with {{variable}}',
            variables: ['variable'],
            metadata: {}
          }
        ]
      });

      manager.registerTemplate(template);
      
      const retrievedTemplate = manager.getTemplate('test-prompt');
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate?.id).toBe('test-prompt');
      expect(retrievedTemplate?.name).toBe('Test Prompt');
    });

    it('should render a prompt with variables', () => {
      const manager = new PromptManager();
      
      const template = new PromptTemplate({
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt template',
        versions: [
          {
            version: '1.0.0',
            template: 'Hello {{name}}, welcome to {{service}}!',
            variables: ['name', 'service'],
            metadata: {}
          }
        ]
      });

      manager.registerTemplate(template);
      
      const renderedPrompt = manager.renderPrompt('test-prompt', {
        variables: {
          name: 'John',
          service: 'Our Platform'
        }
      });

      expect(renderedPrompt).toBe('Hello John, welcome to Our Platform!');
    });

    it('should throw an error when rendering with missing variables', () => {
      const manager = new PromptManager();
      
      const template = new PromptTemplate({
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt template',
        versions: [
          {
            version: '1.0.0',
            template: 'Hello {{name}}, welcome to {{service}}!',
            variables: ['name', 'service'],
            metadata: {}
          }
        ]
      });

      manager.registerTemplate(template);
      
      expect(() => {
        manager.renderPrompt('test-prompt', {
          variables: {
            name: 'John'
            // Missing 'service' variable
          }
        });
      }).toThrow(/Missing required variable/);
    });

    it('should render a specific version of a prompt', () => {
      const manager = new PromptManager();
      
      const template = new PromptTemplate({
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt template',
        versions: [
          {
            version: '1.0.0',
            template: 'Version 1.0.0: {{variable}}',
            variables: ['variable'],
            metadata: {}
          },
          {
            version: '1.1.0',
            template: 'Version 1.1.0: {{variable}}',
            variables: ['variable'],
            metadata: {}
          }
        ]
      });

      manager.registerTemplate(template);
      
      const renderedPromptV1 = manager.renderPrompt('test-prompt', {
        version: '1.0.0',
        variables: {
          variable: 'test'
        }
      });

      expect(renderedPromptV1).toBe('Version 1.0.0: test');

      const renderedPromptV2 = manager.renderPrompt('test-prompt', {
        version: '1.1.0',
        variables: {
          variable: 'test'
        }
      });

      expect(renderedPromptV2).toBe('Version 1.1.0: test');
    });
  });

  describe('Template Versioning', () => {
    it('should handle semantic versioning for templates', () => {
      const template = new PromptTemplate({
        id: 'versioned-prompt',
        name: 'Versioned Prompt',
        description: 'A prompt with multiple versions',
        versions: [
          {
            version: '1.0.0',
            template: 'v1.0.0',
            variables: [],
            metadata: {}
          },
          {
            version: '1.1.0',
            template: 'v1.1.0',
            variables: [],
            metadata: {}
          },
          {
            version: '1.1.1',
            template: 'v1.1.1',
            variables: [],
            metadata: {}
          },
          {
            version: '2.0.0',
            template: 'v2.0.0',
            variables: [],
            metadata: {}
          }
        ]
      });

      expect(template.getLatestVersion().version).toBe('2.0.0');
      expect(template.getLatestVersion('1.x').version).toBe('1.1.1');
      expect(template.getLatestVersion('1.1.x').version).toBe('1.1.1');
      expect(template.getLatestVersion('1.0.x').version).toBe('1.0.0');
    });

    it('should add a new version to an existing template', () => {
      const template = new PromptTemplate({
        id: 'evolving-prompt',
        name: 'Evolving Prompt',
        description: 'A prompt that evolves over time',
        versions: [
          {
            version: '1.0.0',
            template: 'Initial version',
            variables: [],
            metadata: {}
          }
        ]
      });

      expect(template.versions.length).toBe(1);
      
      const newVersion: PromptTemplateVersion = {
        version: '1.1.0',
        template: 'Improved version',
        variables: [],
        metadata: {
          changelog: 'Improved wording'
        }
      };
      
      template.addVersion(newVersion);
      
      expect(template.versions.length).toBe(2);
      expect(template.getLatestVersion().version).toBe('1.1.0');
      expect(template.getLatestVersion().template).toBe('Improved version');
    });
  });

  describe('Advanced Rendering Features', () => {
    it('should support conditional sections in templates', () => {
      const manager = new PromptManager();
      
      const template = new PromptTemplate({
        id: 'conditional-prompt',
        name: 'Conditional Prompt',
        description: 'A prompt with conditional sections',
        versions: [
          {
            version: '1.0.0',
            template: 'Hello {{name}}. {{#if showDetails}}Your account details: {{details}}{{/if}}',
            variables: ['name', 'showDetails', 'details'],
            metadata: {}
          }
        ]
      });

      manager.registerTemplate(template);
      
      // With showDetails = true
      const renderedWithDetails = manager.renderPrompt('conditional-prompt', {
        variables: {
          name: 'John',
          showDetails: true,
          details: 'Premium account'
        }
      });

      expect(renderedWithDetails).toBe('Hello John. Your account details: Premium account');

      // With showDetails = false
      const renderedWithoutDetails = manager.renderPrompt('conditional-prompt', {
        variables: {
          name: 'John',
          showDetails: false,
          details: 'Premium account'
        }
      });

      expect(renderedWithoutDetails).toBe('Hello John. ');
    });

    it('should support loops in templates', () => {
      const manager = new PromptManager();
      
      const template = new PromptTemplate({
        id: 'loop-prompt',
        name: 'Loop Prompt',
        description: 'A prompt with loops',
        versions: [
          {
            version: '1.0.0',
            template: 'Items: {{#each items}}{{name}} ({{price}}), {{/each}}',
            variables: ['items'],
            metadata: {}
          }
        ]
      });

      manager.registerTemplate(template);
      
      const renderedWithLoop = manager.renderPrompt('loop-prompt', {
        variables: {
          items: [
            { name: 'Apple', price: '$1.00' },
            { name: 'Banana', price: '$0.50' },
            { name: 'Orange', price: '$0.75' }
          ]
        }
      });

      expect(renderedWithLoop).toBe('Items: Apple ($1.00), Banana ($0.50), Orange ($0.75), ');
    });
  });
}); 