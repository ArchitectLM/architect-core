/**
 * @file LLM service implementation
 * @module @architectlm/rag
 */

import { ChromaDBConnector } from "../vector-db/chroma-connector.js";
import { Component, ComponentType } from "../models.js";
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

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
   * Make a request to OpenRouter API
   * @private
   */
  private async makeRequest(prompt: string, systemPrompt: string): Promise<string> {
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
                content: systemPrompt
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
   * Get raw response from LLM
   */
  async getRawResponse(prompt: string, systemPrompt: string): Promise<string> {
    return this.makeRequest(prompt, systemPrompt);
  }

  /**
   * Generate a component based on a user request
   */
  async generateComponent(
    request: string,
    componentType: ComponentType,
    systemPrompt: string,
  ): Promise<Component> {
    try {
      const prompt = `Generate a ${componentType} component based on this request: "${request}"`;
      const response = await this.makeRequest(prompt, systemPrompt);
      
      // Ensure the content has the correct component type
      const typeAnnotated = response.includes(`@component type:${componentType}`) 
        ? response 
        : `// @component type:${componentType}\n${response}`;
      
      return {
        id: crypto.randomUUID(),
        name: request.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''),
        type: componentType,
        content: typeAnnotated,
        metadata: {
          description: request,
          tags: request.split(' '),
          path: `components/${request.toLowerCase().replace(/\s+/g, '-')}.ts`,
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
        const pluginDeps = content.match(/import\s+{\s*([^}]+)\s*}\s+from/g);
        if (pluginDeps) {
          relationships.dependsOn = pluginDeps.map(dep => dep.replace(/import\s+{\s*([^}]+)\s*}\s+from/g, '$1'));
        }
        break;
      case 'workflow':
        const workflowDeps = content.match(/ref:\s*'([^']+)'/g);
        if (workflowDeps) {
          relationships.dependsOn = workflowDeps.map(dep => dep.replace(/ref:\s*'([^']+)'/g, '$1'));
        }
        break;
      case 'schema':
        const schemaRefs = content.match(/ref:\s*['"]([^'"]+)['"]/g) || [];
        relationships.dependsOn = schemaRefs.map(ref => ref.replace(/ref:\s*['"]|['"]/g, ''));
        break;
      case 'command':
      case 'query':
        const inputRefs = content.match(/input:\s*{\s*ref:\s*['"]([^'"]+)['"]/g) || [];
        const outputRefs = content.match(/output:\s*{\s*ref:\s*['"]([^'"]+)['"]/g) || [];
        relationships.dependsOn = [
          ...inputRefs.map(ref => ref.replace(/input:\s*{\s*ref:\s*['"]|['"]/g, '')),
          ...outputRefs.map(ref => ref.replace(/output:\s*{\s*ref:\s*['"]|['"]/g, ''))
        ];
        break;
      case 'event':
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
    systemPrompt: string,
  ): Promise<string> {
    const prompt = `Generate educational feedback for the following TypeScript ${component.type} component:
    
    Component Name: ${component.name}
    User Request: "${userRequest}"
    Component Code:
    ${component.content}`;

    return await this.makeRequest(prompt, systemPrompt);
  }
}
