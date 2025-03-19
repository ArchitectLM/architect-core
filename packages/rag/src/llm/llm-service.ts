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
            
            console.log(`\nRate limit exceeded (${remainingRequests}/${limit} requests remaining).`);
            console.log(`Please try again after ${resetTime.toLocaleString()}.`);
            console.log('Consider upgrading your plan for higher limits.\n');
            process.exit(1);
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
  async getRawResponse(
    prompt: string, 
    systemPrompt: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (onChunk) {
      return this.makeStreamingRequest(prompt, systemPrompt, onChunk);
    }
    return this.makeRequest(prompt, systemPrompt);
  }

  /**
   * Generate a component based on a user request
   */
  async generateComponent(
    request: string,
    componentType: ComponentType,
    systemPrompt: string,
  ): Promise<Component[]> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const prompt = `Generate a ${componentType} component based on this request: "${request}".

IMPORTANT: You MUST wrap your response in a TypeScript code block using triple backticks with 'typescript' annotation.
The code block should start with \`\`\`typescript and end with \`\`\`.

Example format:
\`\`\`typescript
import { System } from '../../src/system-api.js';

export default System.component('MyComponent', {
  // Your component code here
});
\`\`\`

Your response should ONLY contain the code block with the component implementation.`;

        let codeBlock = '';
        let isInCodeBlock = false;
        
        const response = await this.getRawResponse(prompt, systemPrompt, (chunk: string) => {
          // Process the chunk to extract code block content in real-time
          const normalizedChunk = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          
          if (!isInCodeBlock && normalizedChunk.includes('```')) {
            const blockStart = normalizedChunk.indexOf('```');
            const afterTicks = normalizedChunk.slice(blockStart + 3);
            if (afterTicks.trim().startsWith('typescript')) {
              isInCodeBlock = true;
              const codeStart = blockStart + 3 + afterTicks.indexOf('typescript') + 'typescript'.length;
              codeBlock += normalizedChunk.slice(codeStart);
            }
          } else if (isInCodeBlock && normalizedChunk.includes('```')) {
            isInCodeBlock = false;
            const codeEnd = normalizedChunk.indexOf('```');
            codeBlock += normalizedChunk.slice(0, codeEnd);
          } else if (isInCodeBlock) {
            codeBlock += normalizedChunk;
          }
        });
        
        if (!codeBlock.trim()) {
          throw new Error('No TypeScript code block found in response');
        }
        
        // Clean up the code block
        const content = codeBlock.trim();
        
        // Split the content into individual components
        const components: Component[] = [];
        const componentBlocks = content.split('// ===').filter(block => block.trim());
        
        for (const block of componentBlocks) {
          const cleanBlock = block.trim();
          if (!cleanBlock) continue;
          
          // Extract component name from the block
          const nameMatch = cleanBlock.match(/export default System\.(?:component|define)\('([^']+)'/);
          if (!nameMatch) continue;
          
          const componentName = nameMatch[1];
          const componentType = cleanBlock.includes('System.define') ? 'system' : 
                              cleanBlock.includes('ComponentType.QUERY') ? 'query' :
                              cleanBlock.includes('ComponentType.COMMAND') ? 'command' :
                              cleanBlock.includes('ComponentType.EVENT') ? 'event' :
                              cleanBlock.includes('ComponentType.WORKFLOW') ? 'workflow' :
                              cleanBlock.includes('ComponentType.SCHEMA') ? 'schema' : 'unknown';
          
          components.push({
            id: crypto.randomUUID(),
            name: componentName,
            type: componentType as ComponentType,
            content: cleanBlock,
            metadata: {
              description: request,
              tags: request.split(' '),
              path: `components/${componentName.toLowerCase().replace(/\s+/g, '-')}.ts`,
              createdAt: Date.now(),
              dependencies: this.extractDependencies(cleanBlock),
              relationships: this.extractRelationships(cleanBlock, componentType as ComponentType)
            }
          });
        }
        
        if (components.length === 0) {
          throw new Error('No valid components found in response');
        }
        
        return components;
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        if (attempt < maxRetries) {
          console.log(`Retrying... (${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
      }
    }

    throw lastError || new Error('Failed to generate component after multiple attempts');
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

  private async makeStreamingRequest(
    prompt: string, 
    systemPrompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    console.log('\n=== Debug: Starting Streaming Request ===');
    console.log('Prompt:', prompt);
    console.log('System Prompt:', systemPrompt);
    
    const maxRetries = 3;
    const initialDelay = 1000;
    let delay = initialDelay;
    const streamTimeout = 300000;
    const chunkTimeout = 300000;
    const maxEmptyChunks = 5;
    let isStreaming = false;
    let fullResponse = '';
    let hasCompleted = false;
    let completionReason = '';
    let consecutiveEmptyChunks = 0;
    let totalChunks = 0;
    let lastChunkTime = Date.now();
    let buffer = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n=== Debug: Attempt ${attempt}/${maxRetries} ===`);
        
        if (hasCompleted) {
          console.log('Debug: Request already completed, returning full response');
          return fullResponse;
        }

        if (isStreaming) {
          console.log('Debug: Still streaming, waiting...');
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        isStreaming = true;
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          throw new Error('OpenRouter API key not found in environment variables');
        }

        console.log('Debug: Making API request...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, streamTimeout);

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
            max_tokens: this.config.maxTokens || 8192,
            temperature: this.config.temperature || 0.7,
            stream: true
          }),
          signal: controller.signal
        });

        console.log('Debug: API Response Status:', response.status);
        
        if (!response.ok) {
          clearTimeout(timeoutId);
          isStreaming = false;
          const responseData = await response.json();
          console.log('Debug: API Error Response:', responseData);
          
          if (response.status === 429) {
            const resetTime = new Date(parseInt(responseData.error?.metadata?.headers?.['X-RateLimit-Reset'] || '0'));
            const remainingRequests = responseData.error?.metadata?.headers?.['X-RateLimit-Remaining'] || 0;
            const limit = responseData.error?.metadata?.headers?.['X-RateLimit-Limit'] || 'unknown';
            
            console.log(`\nRate limit exceeded (${remainingRequests}/${limit} requests remaining).`);
            console.log(`Please try again after ${resetTime.toLocaleString()}.`);
            console.log('Consider upgrading your plan for higher limits.\n');
            process.exit(1);
          }
          throw new Error(`OpenRouter API error: ${responseData.error?.message || 'Unknown error'}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          clearTimeout(timeoutId);
          isStreaming = false;
          throw new Error('Failed to get response reader');
        }

        console.log('Debug: Got response reader, starting to read chunks...');
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          console.log('Debug: Read chunk:', done ? 'done' : 'has value');

          if (done) {
            completionReason = 'Stream reader done';
            clearTimeout(timeoutId);
            isStreaming = false;
            hasCompleted = true;
            break;
          }

          totalChunks++;
          const chunk = decoder.decode(value, { stream: true });
          console.log('Debug: Decoded chunk:', chunk);
          
          if (!chunk.trim()) {
            consecutiveEmptyChunks++;
            if (consecutiveEmptyChunks >= maxEmptyChunks) {
              completionReason = 'Too many empty chunks';
              clearTimeout(timeoutId);
              isStreaming = false;
              hasCompleted = true;
              break;
            }
            continue;
          }
          consecutiveEmptyChunks = 0;

          buffer += chunk;
          lastChunkTime = Date.now();

          // Process complete lines from the buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const data = line.slice(6).trim();
            console.log('Debug: Processing data line:', data);
            
            if (data === '[DONE]') {
              completionReason = 'Received [DONE] marker';
              clearTimeout(timeoutId);
              isStreaming = false;
              hasCompleted = true;
              return fullResponse;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                console.log('Debug: Content from delta:', content);
                fullResponse += content;
                onChunk(content);
              }
            } catch (e) {
              console.log('Debug: Failed to parse JSON:', e);
              continue;
            }
          }

          if (Date.now() - lastChunkTime > chunkTimeout) {
            completionReason = 'Chunk timeout';
            clearTimeout(timeoutId);
            isStreaming = false;
            hasCompleted = true;
            break;
          }
        }

        // Process any remaining content in the buffer
        if (buffer.trim()) {
          console.log('Debug: Processing remaining buffer:', buffer);
          try {
            const data = buffer.slice(6).trim(); // Remove 'data: ' prefix if present
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices?.[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content;
                  console.log('Debug: Content from final buffer:', content);
                  fullResponse += content;
                  onChunk(content);
                }
              } catch (e) {
                console.log('Debug: Failed to parse final buffer as JSON:', e);
                // If not valid JSON, treat as raw content
                fullResponse += buffer;
                onChunk(buffer);
              }
            }
          } catch (e) {
            console.log('Debug: Failed to process final buffer:', e);
            // If parsing fails, add the raw buffer content
            fullResponse += buffer;
            onChunk(buffer);
          }
        }

        clearTimeout(timeoutId);
        isStreaming = false;
        hasCompleted = true;
        console.log('Debug: Request completed successfully');
        return fullResponse;

      } catch (error: any) {
        console.log('Debug: Error in streaming request:', error);
        isStreaming = false;
        if (error.name === 'AbortError') {
          throw new Error('Stream timed out after 5 minutes');
        }
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    if (!hasCompleted) {
      console.log('Debug: Request did not complete successfully');
      throw new Error(`Stream did not complete successfully. Last completion reason: ${completionReason}`);
    }

    return fullResponse;
  }
}
