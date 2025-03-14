/**
 * Agent Extension for ArchitectLM
 * 
 * This extension implements the ArchitectAgent interface to provide AI-assisted
 * development capabilities for generating and modifying system components.
 */

import { 
  ProcessDefinition, 
  TaskDefinition, 
  SystemConfig, 
  TestDefinition, 
  Runtime
} from '../types';

import {
  ArchitectAgent,
  ProcessSpec,
  TaskSpec,
  SystemSpec,
  SystemFeedback,
  SystemFixes,
  Extension
} from './interfaces';

/**
 * Configuration for the Agent extension
 */
export interface AgentConfig {
  /**
   * The LLM provider to use
   */
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  
  /**
   * The model to use
   */
  model: string;
  
  /**
   * API key for the provider
   */
  apiKey?: string;
  
  /**
   * Base URL for the API
   */
  baseUrl?: string;
  
  /**
   * Custom fetch function for making API requests
   */
  fetch?: typeof fetch;
  
  /**
   * Temperature for generation (0-1)
   */
  temperature?: number;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;
  
  /**
   * System prompt to use for generation
   */
  systemPrompt?: string;
  
  /**
   * Custom prompt templates
   */
  promptTemplates?: {
    process?: string;
    task?: string;
    system?: string;
    test?: string;
    feedback?: string;
    documentation?: string;
  };
}

/**
 * Default configuration for the Agent extension
 */
const DEFAULT_CONFIG: AgentConfig = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000,
  systemPrompt: `You are an expert software architect specializing in reactive systems and event-driven architecture. 
Your task is to help design and implement components for the ArchitectLM framework.`
};

/**
 * Agent Extension implementation
 */
export class AgentExtension implements Extension, ArchitectAgent {
  name = 'agent';
  private config: AgentConfig;
  private runtime?: Runtime;
  
  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initialize the extension with the runtime
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    
    // Register this extension as a service
    runtime.registerService('agent', this);
    
    console.log(`Agent extension initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
  }
  
  /**
   * Generate a process definition from a specification
   */
  async generateProcess(spec: ProcessSpec): Promise<ProcessDefinition> {
    console.log(`Generating process: ${spec.name}`);
    
    const prompt = this.createProcessPrompt(spec);
    const response = await this.callLLM(prompt);
    
    try {
      // Parse the response as JSON
      const processDefinition = JSON.parse(response);
      return processDefinition;
    } catch (error: unknown) {
      console.error('Failed to parse process definition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate process definition: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a task definition from a specification
   */
  async generateTask(spec: TaskSpec): Promise<TaskDefinition> {
    console.log(`Generating task: ${spec.name}`);
    
    const prompt = this.createTaskPrompt(spec);
    const response = await this.callLLM(prompt);
    
    try {
      // Parse the response as JSON
      const taskDefinition = JSON.parse(response);
      return taskDefinition;
    } catch (error: unknown) {
      console.error('Failed to parse task definition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate task definition: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a system configuration from a specification
   */
  async generateSystem(spec: SystemSpec): Promise<SystemConfig> {
    console.log(`Generating system: ${spec.name}`);
    
    const prompt = this.createSystemPrompt(spec);
    const response = await this.callLLM(prompt);
    
    try {
      // Parse the response as JSON
      const systemConfig = JSON.parse(response);
      return systemConfig;
    } catch (error: unknown) {
      console.error('Failed to parse system configuration:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate system configuration: ${errorMessage}`);
    }
  }
  
  /**
   * Analyze feedback and suggest fixes
   */
  async analyzeFeedback(feedback: SystemFeedback): Promise<SystemFixes> {
    console.log('Analyzing system feedback');
    
    const prompt = this.createFeedbackPrompt(feedback);
    const response = await this.callLLM(prompt);
    
    try {
      // Parse the response as JSON
      const fixes = JSON.parse(response);
      return fixes;
    } catch (error: unknown) {
      console.error('Failed to parse system fixes:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze feedback: ${errorMessage}`);
    }
  }
  
  /**
   * Generate tests for a component
   */
  async generateTests(component: ProcessDefinition | TaskDefinition): Promise<TestDefinition[]> {
    console.log(`Generating tests for: ${component.id}`);
    
    const prompt = this.createTestPrompt(component);
    const response = await this.callLLM(prompt);
    
    try {
      // Parse the response as JSON
      const tests = JSON.parse(response);
      return tests;
    } catch (error: unknown) {
      console.error('Failed to parse test definitions:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate tests: ${errorMessage}`);
    }
  }
  
  /**
   * Generate documentation for a component
   */
  async generateDocs(component: any): Promise<string> {
    console.log(`Generating documentation for: ${component.id || 'component'}`);
    
    const prompt = this.createDocumentationPrompt(component);
    const response = await this.callLLM(prompt);
    
    return response;
  }
  
  /**
   * Create a prompt for generating a process
   */
  private createProcessPrompt(spec: ProcessSpec): string {
    const template = this.config.promptTemplates?.process || `
You are designing a process for a reactive system using the ArchitectLM framework.

Process Specification:
- Name: {{name}}
- Description: {{description}}
{{#if domainConcepts}}
- Domain Concepts: {{domainConcepts}}
{{/if}}
{{#if businessRules}}
- Business Rules: {{businessRules}}
{{/if}}
{{#if states}}
- States: {{states}}
{{/if}}
{{#if events}}
- Events: {{events}}
{{/if}}

Create a complete ProcessDefinition object that implements this specification.
The ProcessDefinition should include:
1. A unique ID
2. States with descriptions and optional onEnter/onExit handlers
3. Transitions between states with event triggers
4. Guards and actions for transitions where appropriate
5. A context schema using Zod for validation

Return ONLY the JSON object representing the ProcessDefinition.
`;

    // Simple template replacement
    return template
      .replace('{{name}}', spec.name)
      .replace('{{description}}', spec.description || '')
      .replace('{{#if domainConcepts}}', spec.domainConcepts ? '' : '<!--')
      .replace('{{/if}}', spec.domainConcepts ? '' : '-->')
      .replace('{{domainConcepts}}', spec.domainConcepts?.join(', ') || '')
      .replace('{{#if businessRules}}', spec.businessRules ? '' : '<!--')
      .replace('{{/if}}', spec.businessRules ? '' : '-->')
      .replace('{{businessRules}}', spec.businessRules?.join(', ') || '')
      .replace('{{#if states}}', spec.states ? '' : '<!--')
      .replace('{{/if}}', spec.states ? '' : '-->')
      .replace('{{states}}', spec.states?.join(', ') || '')
      .replace('{{#if events}}', spec.events ? '' : '<!--')
      .replace('{{/if}}', spec.events ? '' : '-->')
      .replace('{{events}}', spec.events?.join(', ') || '');
  }
  
  /**
   * Create a prompt for generating a task
   */
  private createTaskPrompt(spec: TaskSpec): string {
    const template = this.config.promptTemplates?.task || `
You are designing a task for a reactive system using the ArchitectLM framework.

Task Specification:
- Name: {{name}}
- Description: {{description}}
{{#if input}}
- Input: {{input}}
{{/if}}
{{#if output}}
- Output: {{output}}
{{/if}}
{{#if dependencies}}
- Dependencies: {{dependencies}}
{{/if}}

Create a complete TaskDefinition object that implements this specification.
The TaskDefinition should include:
1. A unique ID
2. An implementation function that performs the task
3. Input and output schemas using Zod for validation
4. Error handling
5. Appropriate timeout and retry configuration

Return ONLY the JSON object representing the TaskDefinition.
`;

    // Simple template replacement
    return template
      .replace('{{name}}', spec.name)
      .replace('{{description}}', spec.description || '')
      .replace('{{#if input}}', spec.input ? '' : '<!--')
      .replace('{{/if}}', spec.input ? '' : '-->')
      .replace('{{input}}', spec.input ? JSON.stringify(spec.input) : '')
      .replace('{{#if output}}', spec.output ? '' : '<!--')
      .replace('{{/if}}', spec.output ? '' : '-->')
      .replace('{{output}}', spec.output ? JSON.stringify(spec.output) : '')
      .replace('{{#if dependencies}}', spec.dependencies ? '' : '<!--')
      .replace('{{/if}}', spec.dependencies ? '' : '-->')
      .replace('{{dependencies}}', spec.dependencies?.join(', ') || '');
  }
  
  /**
   * Create a prompt for generating a system
   */
  private createSystemPrompt(spec: SystemSpec): string {
    const template = this.config.promptTemplates?.system || `
You are designing a reactive system using the ArchitectLM framework.

System Specification:
- Name: {{name}}
- Description: {{description}}
- Processes: {{processes}}
- Tasks: {{tasks}}

Create a complete SystemConfig object that implements this specification.
The SystemConfig should include:
1. A unique ID
2. Process definitions for each process
3. Task definitions for each task
4. Appropriate extensions and observability configuration

Return ONLY the JSON object representing the SystemConfig.
`;

    // Simple template replacement
    return template
      .replace('{{name}}', spec.name)
      .replace('{{description}}', spec.description || '')
      .replace('{{processes}}', JSON.stringify(spec.processes || []))
      .replace('{{tasks}}', JSON.stringify(spec.tasks || []));
  }
  
  /**
   * Create a prompt for analyzing feedback
   */
  private createFeedbackPrompt(feedback: SystemFeedback): string {
    const template = this.config.promptTemplates?.feedback || `
You are analyzing feedback for a reactive system built with the ArchitectLM framework.

System Feedback:
- Validation Results: {{validation}}
- Test Results: {{tests}}
- Static Analysis Results: {{staticAnalysis}}

Analyze this feedback and suggest fixes for the system components.
Your response should include:
1. Updated component definitions
2. An explanation of the changes made

Return ONLY the JSON object representing the SystemFixes.
`;

    // Simple template replacement
    return template
      .replace('{{validation}}', JSON.stringify(feedback.validation))
      .replace('{{tests}}', JSON.stringify(feedback.tests))
      .replace('{{staticAnalysis}}', JSON.stringify(feedback.staticAnalysis));
  }
  
  /**
   * Create a prompt for generating tests
   */
  private createTestPrompt(component: ProcessDefinition | TaskDefinition): string {
    const template = this.config.promptTemplates?.test || `
You are creating tests for a component in the ArchitectLM framework.

Component:
{{component}}

Create a set of test definitions that thoroughly test this component.
The tests should include:
1. Happy path scenarios
2. Edge cases
3. Error handling

Return ONLY the JSON array of TestDefinition objects.
`;

    // Simple template replacement
    return template
      .replace('{{component}}', JSON.stringify(component, null, 2));
  }
  
  /**
   * Create a prompt for generating documentation
   */
  private createDocumentationPrompt(component: any): string {
    const template = this.config.promptTemplates?.documentation || `
You are creating documentation for a component in the ArchitectLM framework.

Component:
{{component}}

Create comprehensive markdown documentation for this component.
The documentation should include:
1. Overview
2. Usage examples
3. API reference
4. Best practices

Return ONLY the markdown documentation.
`;

    // Simple template replacement
    return template
      .replace('{{component}}', JSON.stringify(component, null, 2));
  }
  
  /**
   * Call the LLM with a prompt
   */
  private async callLLM(prompt: string): Promise<string> {
    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'local':
        return this.callLocal(prompt);
      case 'custom':
        if (!this.config.fetch) {
          throw new Error('Custom provider requires a fetch function');
        }
        return this.callCustom(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }
  
  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    const fetchFn = this.config.fetch || fetch;
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    
    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    const fetchFn = this.config.fetch || fetch;
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
    
    const response = await fetchFn(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        system: this.config.systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  /**
   * Call local LLM
   */
  private async callLocal(prompt: string): Promise<string> {
    // This is a placeholder for local LLM integration
    // In a real implementation, this would call a locally running model
    console.log('Local LLM not implemented, returning mock response');
    return '{"id": "mock-response", "name": "Mock Response"}';
  }
  
  /**
   * Call custom LLM API
   */
  private async callCustom(prompt: string): Promise<string> {
    if (!this.config.fetch) {
      throw new Error('Custom provider requires a fetch function');
    }
    
    if (!this.config.baseUrl) {
      throw new Error('Custom provider requires a base URL');
    }
    
    const response = await this.config.fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
      },
      body: JSON.stringify({
        prompt,
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Custom API error: ${error.error?.message || JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    return data.response || data.text || data.content || JSON.stringify(data);
  }
}

/**
 * Create an agent extension
 */
export function createAgent(config: Partial<AgentConfig> = {}): AgentExtension {
  return new AgentExtension(config);
} 