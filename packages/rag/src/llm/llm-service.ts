/**
 * @file LLM service implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType } from "../models.js";
import dotenv from 'dotenv';
import path from 'path';
import { ChromaDBConnector } from "../vector-db/chroma-connector.js";
import crypto from 'crypto';

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
  vectorDB?: ChromaDBConnector;
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
      model: "google/gemma-2-9b-it:free",
      maxTokens: 500,
      temperature: 0.7,
      apiKey,
      baseUrl: this.OPENROUTER_BASE_URL,
      ...config,
    };
  }

  /**
   * Get relevant context from vector database
   */
  public async getRelevantContext(request: string, componentType: ComponentType): Promise<string> {
    try {
      if (!this.config.vectorDB) {
        throw new Error('Vector DB not configured');
      }

      // First, get system documentation and examples
      const systemResults = await this.config.vectorDB.search('', {
        limit: 10,
        threshold: 0.0, // Lower threshold to get all components
        includeMetadata: true,
        includeEmbeddings: false,
        orderBy: 'relevance',
        orderDirection: 'desc',
        types: ['plugin' as const] // Get documentation
      });

      // Then, get components related to the request
      const requestResults = await this.config.vectorDB.search(request, {
        limit: 5,
        threshold: 0.7,
        includeMetadata: true,
        includeEmbeddings: false,
        orderBy: 'relevance',
        orderDirection: 'desc',
        types: [componentType, 'plugin' as const] // Include both specific type and documentation
      });

      // Combine and deduplicate results
      const allResults = [...systemResults, ...requestResults];
      const uniqueResults = Array.from(
        new Map(allResults.map(result => [result.component.id, result])).values()
      );

      // Separate documentation and examples
      const documentation = uniqueResults.filter(r => {
        const tags = r.component.metadata.tags;
        return Array.isArray(tags) ? tags.includes('documentation') : false;
      });
      const examples = uniqueResults.filter(r => {
        const tags = r.component.metadata.tags;
        return !Array.isArray(tags) || !tags.includes('documentation');
      });

      // Build context from relevant components
      const context = `System Context:

Documentation:
${documentation.map(result => {
  const component = result.component;
  return `${component.content}`;
}).join('\n')}

Similar Examples:
${examples.map(result => {
  const component = result.component;
  return `Component: ${component.name} (${component.type})
Description: ${component.metadata.description || 'No description'}
Content:
${component.content}
---`;
}).join('\n')}

User Request: ${request}
Component Type: ${componentType}

IMPORTANT: Generate a DSL component following these strict rules:
1. Use the exact DSL format specified below
2. Follow the existing project structure
3. Integrate with related components
4. Maintain consistency with the current DSL patterns
5. Include proper metadata and relationships

DSL Format Requirements:
1. Component Definition:
   - Start with a clear component type declaration
   - Include a unique identifier
   - Specify version and metadata

2. Properties:
   - Define all required properties with types
   - Include validation rules
   - Add default values where appropriate

3. Methods:
   - Define clear method signatures
   - Include input/output type definitions
   - Add proper error handling

4. Relationships:
   - Define dependencies on other components
   - Specify usage relationships
   - Include extension/implementation relationships

5. Metadata:
   - Include proper tags
   - Add version information
   - Specify author and creation date

Example DSL Format:
\`\`\`typescript
// @component type:${componentType}
// @component id:unique-id
// @component version:1.0.0
// @component author:system
// @component tags:${this.extractTagsFromRequest(request).join(',')}

interface ComponentName {
  // Properties
  property1: string;
  property2: number;
  
  // Methods
  method1(input: InputType): Promise<OutputType>;
  method2(): void;
  
  // Relationships
  dependsOn: ['component1', 'component2'];
  usedBy: ['component3'];
}

// Implementation
class ComponentNameImpl implements ComponentName {
  // Implementation details
}
\`\`\`

Please generate a component following this exact format.`;

      return context;
    } catch (error) {
      console.error('Error getting relevant context:', error);
      return 'Error retrieving context.';
    }
  }

  /**
   * Make a request to OpenRouter API
   * @private
   */
  private async makeRequest(prompt: string): Promise<string> {
    const maxRetries = 3;
    const initialDelay = 1000; // 1 second
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          throw new Error('OpenRouter API key not found in environment variables');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/architectlm/rag',
            'X-Title': 'RAG DSL Editor'
          },
          body: JSON.stringify({
            model: 'google/gemma-2-9b-it:free',
            messages: [
              {
                role: 'system',
                content: `You are a DSL (Domain-Specific Language) expert specializing in authentication and security components. Your task is to generate DSL components that strictly follow the provided format.

IMPORTANT: Your response MUST follow this EXACT format:

// @component type:function
// @component id:${Date.now()}
// @component version:1.0.0
// @component author:system
// @component tags:auth,security
// @component dependencies:["jsonwebtoken", "bcrypt", "rate-limiter-flexible", "winston"]

// @interface AuthenticationConfig
interface AuthenticationConfig {
  // @property secretKey:string
  secretKey: string;
  
  // @property tokenExpiration:number
  tokenExpiration: number;
  
  // @property refreshTokenExpiration:number
  refreshTokenExpiration: number;
  
  // @property rateLimit:number
  rateLimit: number;
}

// @class Authenticator
class Authenticator {
  // @property config:AuthenticationConfig
  private config: AuthenticationConfig;
  
  // @constructor
  constructor(config: AuthenticationConfig) {
    this.config = config;
  }
  
  // @method generateToken
  // @param user:any
  // @returns string
  public generateToken(user: any): string {
    // Implementation
  }
  
  // @method validateToken
  // @param token:string
  // @returns any
  public validateToken(token: string): any {
    // Implementation
  }
}

// @relationships
// @dependsOn:["UserService", "TokenService"]
// @usedBy:["AuthMiddleware", "LoginController"]
// @extends:["BaseAuthenticator"]
// @implements:["IAuthenticator"]

Key Requirements:
1. EVERY component MUST start with @component annotations
2. EVERY interface MUST start with @interface annotation
3. EVERY class MUST start with @class annotation
4. EVERY property MUST have @property annotation
5. EVERY method MUST have @method annotation
6. EVERY parameter MUST have @param annotation
7. EVERY return type MUST have @returns annotation
8. EVERY relationship MUST be defined with @relationships annotation
9. ALL dependencies MUST be listed in @component dependencies
10. ALL relationships MUST be explicitly defined

For authentication components specifically:
- Use JWT tokens for secure authentication
- Implement proper token validation and verification
- Include refresh token functionality
- Handle token expiration
- Follow OAuth 2.0 best practices
- Include proper error handling for authentication failures
- Use secure password hashing
- Implement rate limiting
- Include proper logging for security events

IMPORTANT: Your response must be ONLY the DSL component code, following the EXACT format specified above. Do not include any explanations or additional text.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 1000,
            temperature: 0.7
          })
        });

        const data = await response.json();
        console.log('OpenRouter API Response:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
          if (response.status === 429) {
            const resetTime = new Date(parseInt(data.error?.metadata?.headers?.['X-RateLimit-Reset'] || '0'));
            const remainingRequests = data.error?.metadata?.headers?.['X-RateLimit-Remaining'] || 0;
            const limit = data.error?.metadata?.headers?.['X-RateLimit-Limit'] || 'unknown';
            
            if (attempt < maxRetries) {
              console.log(`Rate limit hit (${remainingRequests}/${limit} requests remaining). Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // Exponential backoff
              continue;
            }
            
            throw new Error(
              `Rate limit exceeded (${remainingRequests}/${limit} requests remaining). ` +
              `Please try again after ${resetTime.toLocaleString()}. ` +
              `Consider upgrading your plan for higher limits.`
            );
          }
          throw new Error(`OpenRouter API error: ${data.error?.message || 'Unknown error'}`);
        }

        if (!data.choices?.[0]?.message?.content) {
          console.error('Invalid response structure:', JSON.stringify(data, null, 2));
          throw new Error('Invalid response format from OpenRouter API');
        }

        return data.choices[0].message.content;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.error(`Attempt ${attempt} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    throw new Error('All retry attempts failed');
  }

  /**
   * Generate a component based on a user request
   */
  async generateComponent(
    request: string,
    componentType: ComponentType,
    context?: string,
  ): Promise<Component> {
    try {
      // Extract component name from request
      const name = this.extractNameFromRequest(request, componentType);
      
      // Extract tags from request
      const tags = this.extractTagsFromRequest(request);

      // Build prompt with context if provided
      const contextPrompt = context ? `\nContext:\n${context}\n` : '';
      
      const prompt = `Generate a ${componentType} component based on this request: "${request}"
${contextPrompt}
Follow the DSL format exactly.`;

      // Get response from LLM
      const response = await this.makeRequest(prompt);
      
      // Ensure the content has the correct component type
      const typeAnnotated = response.includes(`@component type:${componentType}`) 
        ? response 
        : `// @component type:${componentType}\n${response}`;
      
      return {
        id: crypto.randomUUID(),
        name,
        type: componentType,
        content: typeAnnotated,
        metadata: {
          description: request,
          tags,
          path: `components/${this.kebabCase(name)}.ts`,
          createdAt: Date.now(),
          dependencies: this.extractDependencies(typeAnnotated),
          relationships: this.extractRelationships(typeAnnotated, componentType)
        }
      };
    } catch (error) {
      console.error('Error generating component:', error);
      throw new Error('Error generating component');
    }
  }

  private extractDependencies(content: string): string[] {
    // Extract dependencies from the component content
    const dependencies: string[] = [];
    
    // Look for imports
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    // Look for component references
    const refRegex = /ref:\s*['"]([^'"]+)['"]/g;
    while ((match = refRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)];
  }

  private extractRelationships(content: string, componentType: ComponentType): { dependsOn: string[]; usedBy: string[]; extends: string[]; implements: string[]; } {
    const relationships = {
      dependsOn: [] as string[],
      usedBy: [] as string[],
      extends: [] as string[],
      implements: [] as string[],
    };

    // Extract relationships based on component type
    switch (componentType) {
      case 'plugin':
        // Extract plugin dependencies
        const pluginDeps = content.match(/import\s+{\s*([^}]+)\s*}\s+from/g);
        if (pluginDeps) {
          relationships.dependsOn = pluginDeps.map(dep => dep.replace(/import\s+{\s*([^}]+)\s*}\s+from/g, '$1'));
        }
        break;
      case 'workflow':
        // Extract workflow dependencies
        const workflowDeps = content.match(/ref:\s*'([^']+)'/g);
        if (workflowDeps) {
          relationships.dependsOn = workflowDeps.map(dep => dep.replace(/ref:\s*'([^']+)'/g, '$1'));
        }
      case 'schema':
        // Look for schema references
        const schemaRefs = content.match(/ref:\s*['"]([^'"]+)['"]/g) || [];
        relationships.dependsOn = schemaRefs.map(ref => ref.replace(/ref:\s*['"]|['"]/g, ''));
        break;
      case 'command':
      case 'query':
        // Look for input/output schema references
        const inputRefs = content.match(/input:\s*{\s*ref:\s*['"]([^'"]+)['"]/g) || [];
        const outputRefs = content.match(/output:\s*{\s*ref:\s*['"]([^'"]+)['"]/g) || [];
        relationships.dependsOn = [
          ...inputRefs.map(ref => ref.replace(/input:\s*{\s*ref:\s*['"]|['"]/g, '')),
          ...outputRefs.map(ref => ref.replace(/output:\s*{\s*ref:\s*['"]|['"]/g, ''))
        ];
        break;
      case 'event':
        // Look for event payload schema references
        const payloadRefs = content.match(/payload:\s*{\s*ref:\s*['"]([^'"]+)['"]/g) || [];
        relationships.dependsOn = payloadRefs.map(ref => ref.replace(/payload:\s*{\s*ref:\s*['"]|['"]/g, ''));
        break;
    }

    return relationships;
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
            "plugin",
            "class",
            "component",
            "a",
            "an",
            "the",
          ].includes(word.toLowerCase()),
      );

    // Process words for the base name
    const processedWords = words.map((word, index) => {
      // Remove component type suffixes if they exist
      const cleanWord = word.replace(/(Command|Event|Query|Schema|Workflow|Extension|Plugin)$/i, '');
      // Capitalize each word
      return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
    });

    // Join words for base name
    let baseName = processedWords.join('');

    // Add a suffix based on the component type
    switch (componentType) {
      case 'plugin':
        // For plugins, make the first character lowercase
        return baseName.charAt(0).toLowerCase() + baseName.slice(1);
      case 'command':
        return `${baseName}Command`;
      case 'event':
        return `${baseName}Event`;
      case 'query':
        return `${baseName}Query`;
      case 'schema':
        return `${baseName}Schema`;
      case 'workflow':
        return `${baseName}Workflow`;
      case 'extension':
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
