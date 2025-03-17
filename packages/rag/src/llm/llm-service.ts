/**
 * @file LLM service implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType } from "../models.js";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

// Debug logging
console.log('Environment variables loaded from:', rootEnvPath);
console.log('API Key available:', !!process.env.OPENROUTER_API_KEY);

/**
 * Configuration for the LLM service
 */
export interface LLMServiceConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
}

/**
 * LLM service for generating components and feedback
 */
export class LLMService {
  private config: LLMServiceConfig;
  private readonly OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

  /**
   * Create a new LLM service
   */
  constructor(config: LLMServiceConfig = {}) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    this.config = {
      model: "openai/gpt-3.5-turbo",
      maxTokens: 500,
      temperature: 0.7,
      apiKey,
      baseUrl: this.OPENROUTER_BASE_URL,
      ...config,
    };
  }

  /**
   * Make a request to OpenRouter API
   * @private
   */
  private async makeRequest(prompt: string): Promise<string> {
    try {
      console.log('Making request to OpenRouter API...');
      console.log('Model:', this.config.model);
      console.log('Max tokens:', this.config.maxTokens);
      console.log('Temperature:', this.config.temperature);

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://github.com/architectlm/rag',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant that generates TypeScript code components.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error response:', errorText);
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenRouter API response:', JSON.stringify(data, null, 2));

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid response format from OpenRouter API');
      }

      const content = data.choices[0].message?.content;
      if (!content) {
        throw new Error('No content in response from OpenRouter API');
      }

      return content;
    } catch (error) {
      console.error('Error making OpenRouter API request:', error);
      throw error;
    }
  }

  /**
   * Generate a component based on a user request
   */
  async generateComponent(
    request: string,
    componentType: ComponentType,
  ): Promise<Component> {
    // Extract a name from the request
    const name = this.extractNameFromRequest(request, componentType);

    // Generate prompt for the LLM
    const prompt = `Generate a TypeScript ${componentType} component named "${name}" based on the following request: "${request}". 
    The component should be well-documented with JSDoc comments and follow TypeScript best practices.
    Include proper error handling and type safety.
    Return only the TypeScript code without any explanations.`;

    // Get content from OpenRouter
    const content = await this.makeRequest(prompt);

    // Determine the path based on component type
    const path = `src/${componentType.toLowerCase()}s/${this.kebabCase(name)}.ts`;

    // Create the component
    const component: Component = {
      type: componentType,
      name,
      content,
      metadata: {
        path,
        description: `Generated ${componentType} based on user request: "${request}"`,
        createdAt: Date.now(),
        author: "LLM",
        tags: this.extractTagsFromRequest(request),
      },
    };

    return component;
  }

  /**
   * Generate educational feedback for a component
   */
  async generateFeedback(
    component: Component,
    userRequest: string,
  ): Promise<string> {
    const prompt = `Generate educational feedback for the following TypeScript ${component.type} component:
    
    Component Name: ${component.name}
    User Request: "${userRequest}"
    Component Code:
    ${component.content}

    Please provide feedback in the following format:
    1. Component Overview
    2. Implementation Details
    3. Best Practices Applied
    4. How to Use This Component
    5. How to Extend This Component

    Make the feedback educational and helpful.`;

    return await this.makeRequest(prompt);
  }

  /**
   * Extract a name from the user request
   * @private
   */
  private extractNameFromRequest(
    request: string,
    componentType: ComponentType,
  ): string {
    // In a real implementation, this would use NLP to extract a meaningful name
    // For now, we'll just use a simple heuristic

    // Extract words that might be part of the name
    const words = request
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "create",
            "make",
            "build",
            "implement",
            "develop",
            "function",
            "class",
            "component",
          ].includes(word.toLowerCase()),
      );

    // Use the first word as the base name
    let baseName = words.length > 0 ? words[0] : "Default";

    // Capitalize the first letter
    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

    // Add a suffix based on the component type
    switch (componentType) {
      case ComponentType.Function:
        return this.camelCase(baseName);
      case ComponentType.Command:
        return `${baseName}Command`;
      case ComponentType.Event:
        return `${baseName}Event`;
      case ComponentType.Query:
        return `${baseName}Query`;
      case ComponentType.Schema:
        return `${baseName}Schema`;
      case ComponentType.Pipeline:
        return `${baseName}Pipeline`;
      case ComponentType.Extension:
        return `${baseName}Extension`;
      default:
        return baseName;
    }
  }

  /**
   * Extract tags from the user request
   * @private
   */
  private extractTagsFromRequest(request: string): string[] {
    // In a real implementation, this would use NLP to extract meaningful tags
    // For now, we'll just use a simple heuristic

    const commonTags = [
      "payment",
      "discount",
      "user",
      "product",
      "order",
      "calculation",
      "validation",
    ];

    return commonTags.filter((tag) => request.toLowerCase().includes(tag));
  }

  /**
   * Generate function content
   * @private
   */
  private generateFunctionContent(name: string, request: string): string {
    if (request.toLowerCase().includes('authentication') && request.toLowerCase().includes('password reset')) {
      return `/**
 * User authentication service with password reset functionality
 * 
 * Generated based on request: "${request}"
 */
export class UserAuthService {
  private users: Map<string, { email: string; password: string; resetToken?: string }> = new Map();

  /**
   * Register a new user
   * @param email User's email
   * @param password User's password
   * @returns Success status
   */
  async register(email: string, password: string): Promise<boolean> {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }

    // In a real implementation, we would hash the password
    this.users.set(email, { email, password });
    return true;
  }

  /**
   * Authenticate a user
   * @param email User's email
   * @param password User's password
   * @returns Success status
   */
  async login(email: string, password: string): Promise<boolean> {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    // In a real implementation, we would compare hashed passwords
    if (user.password !== password) {
      throw new Error('Invalid password');
    }

    return true;
  }

  /**
   * Request a password reset
   * @param email User's email
   * @returns Reset token
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate a reset token
    const resetToken = Math.random().toString(36).substring(2);
    user.resetToken = resetToken;
    this.users.set(email, user);

    // In a real implementation, we would send this token via email
    return resetToken;
  }

  /**
   * Reset a user's password
   * @param email User's email
   * @param resetToken Reset token
   * @param newPassword New password
   * @returns Success status
   */
  async resetPassword(email: string, resetToken: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.resetToken || user.resetToken !== resetToken) {
      throw new Error('Invalid reset token');
    }

    // Update the password and clear the reset token
    user.password = newPassword;
    user.resetToken = undefined;
    this.users.set(email, user);

    return true;
  }
}`;
    }

    // Default implementation for other function types
    return `/**
 * ${this.capitalizeFirstLetter(name)} function
 * 
 * Generated based on request: "${request}"
 * 
 * @param param1 First parameter
 * @param param2 Second parameter
 * @returns Result of the operation
 */
export function ${name}(param1: number, param2: number): number {
  // Implementation would be generated by LLM based on the request
  return param1 + param2;
}`;
  }

  /**
   * Generate command content
   * @private
   */
  private generateCommandContent(name: string, request: string): string {
    return `/**
 * ${name} class
 * 
 * Generated based on request: "${request}"
 */
export class ${name} {
  /**
   * Execute the command
   * 
   * @param param1 First parameter
   * @param param2 Second parameter
   * @returns Result of the command execution
   */
  execute(param1: number, param2: number): number {
    // Implementation would be generated by LLM based on the request
    return param1 + param2;
  }
}`;
  }

  /**
   * Generate event content
   * @private
   */
  private generateEventContent(name: string, request: string): string {
    return `/**
 * ${name} class
 * 
 * Generated based on request: "${request}"
 */
export class ${name} {
  constructor(public readonly data: any) {}
  
  /**
   * Get event type
   */
  get type(): string {
    return '${this.kebabCase(name)}';
  }
}`;
  }

  /**
   * Generate query content
   * @private
   */
  private generateQueryContent(name: string, request: string): string {
    return `/**
 * ${name} class
 * 
 * Generated based on request: "${request}"
 */
export class ${name} {
  /**
   * Execute the query
   * 
   * @param param1 First parameter
   * @param param2 Second parameter
   * @returns Result of the query execution
   */
  execute(param1: number, param2: number): Promise<any> {
    // Implementation would be generated by LLM based on the request
    return Promise.resolve({ result: param1 + param2 });
  }
}`;
  }

  /**
   * Generate schema content
   * @private
   */
  private generateSchemaContent(name: string, request: string): string {
    return `/**
 * ${name} interface
 * 
 * Generated based on request: "${request}"
 */
export interface ${name} {
  id: string;
  name: string;
  value: number;
  createdAt: Date;
}`;
  }

  /**
   * Generate pipeline content
   * @private
   */
  private generatePipelineContent(name: string, request: string): string {
    return `/**
 * ${name} class
 * 
 * Generated based on request: "${request}"
 */
export class ${name} {
  /**
   * Execute the pipeline
   * 
   * @param input Pipeline input
   * @returns Pipeline output
   */
  async execute(input: any): Promise<any> {
    // Step 1: Validate input
    this.validateInput(input);
    
    // Step 2: Process input
    const result = await this.processInput(input);
    
    // Step 3: Format output
    return this.formatOutput(result);
  }
  
  /**
   * Validate pipeline input
   * @private
   */
  private validateInput(input: any): void {
    // Implementation would be generated by LLM based on the request
  }
  
  /**
   * Process pipeline input
   * @private
   */
  private async processInput(input: any): Promise<any> {
    // Implementation would be generated by LLM based on the request
    return input;
  }
  
  /**
   * Format pipeline output
   * @private
   */
  private formatOutput(result: any): any {
    // Implementation would be generated by LLM based on the request
    return result;
  }
}`;
  }

  /**
   * Generate extension content
   * @private
   */
  private generateExtensionContent(name: string, request: string): string {
    return `/**
 * ${name} class
 * 
 * Generated based on request: "${request}"
 */
export class ${name} {
  /**
   * Initialize the extension
   */
  initialize(): void {
    // Implementation would be generated by LLM based on the request
  }
  
  /**
   * Execute the extension
   * 
   * @param param1 First parameter
   * @param param2 Second parameter
   * @returns Result of the extension execution
   */
  execute(param1: number, param2: number): number {
    // Implementation would be generated by LLM based on the request
    return param1 + param2;
  }
}`;
  }

  /**
   * Extract implementation details from a component
   * @private
   */
  private extractImplementationDetails(component: Component): string {
    // In a real implementation, this would analyze the component code
    // For now, we'll just return some generic details

    return `- Takes input parameters and processes them
- Performs validation on inputs
- Returns a result based on the operation
- Follows TypeScript best practices`;
  }

  /**
   * Extract best practices from a component
   * @private
   */
  private extractBestPractices(component: Component): string {
    // In a real implementation, this would analyze the component code
    // For now, we'll just return some generic best practices

    return `- Clear naming conventions
- Type safety with TypeScript
- JSDoc comments for documentation
- Single responsibility principle
- Error handling`;
  }

  /**
   * Generate a usage example for a component
   * @private
   */
  private generateUsageExample(component: Component): string {
    // In a real implementation, this would generate a realistic example
    // For now, we'll just return a simple example based on the component type

    switch (component.type) {
      case ComponentType.Function:
        return `const result = ${component.name}(10, 20);
console.log(result); // Output: 30`;

      case ComponentType.Command:
        return `const command = new ${component.name}();
const result = command.execute(10, 20);
console.log(result); // Output: 30`;

      case ComponentType.Event:
        return `const event = new ${component.name}({ value: 42 });
eventBus.publish(event.type, event);`;

      case ComponentType.Query:
        return `const query = new ${component.name}();
const result = await query.execute(10, 20);
console.log(result); // Output: { result: 30 }`;

      case ComponentType.Schema:
        return `const item: ${component.name} = {
  id: "123",
  name: "Test",
  value: 42,
  createdAt: new Date()
};`;

      case ComponentType.Pipeline:
        return `const pipeline = new ${component.name}();
const result = await pipeline.execute({ value: 42 });
console.log(result); // Output: processed result`;

      case ComponentType.Extension:
        return `const extension = new ${component.name}();
extension.initialize();
const result = extension.execute(10, 20);
console.log(result); // Output: 30`;

      default:
        return `// Example usage for ${component.name}`;
    }
  }

  /**
   * Suggest extensions for a component
   * @private
   */
  private suggestExtensions(component: Component): string {
    // In a real implementation, this would analyze the component and suggest meaningful extensions
    // For now, we'll just return some generic suggestions

    return `- Adding validation for input parameters
- Implementing error handling
- Adding logging or telemetry
- Supporting additional use cases
- Adding unit tests`;
  }

  /**
   * Convert a string to camelCase
   * @private
   */
  private camelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase(),
      )
      .replace(/\s+/g, "");
  }

  /**
   * Convert a string to kebab-case
   * @private
   */
  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }

  /**
   * Capitalize the first letter of a string
   * @private
   */
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
