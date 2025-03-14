/**
 * RAG-Enhanced Agent Extension for ArchitectLM
 * 
 * This extension implements the ArchitectAgent interface with Retrieval-Augmented Generation
 * to provide AI-assisted development capabilities for generating and modifying system components.
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
  Extension,
  ServiceRegistry,
  DatabaseSchemaSpec,
  DatabaseSchemaDefinition,
  APIEndpointSpec,
  APIEndpointDefinition,
  UIComponentSpec,
  UIComponentDefinition
} from './interfaces';

// Import our DSL components
import { ReactiveSystem } from '../dsl/reactive-system';
import { createAssembler } from '../dsl/assembler';
import { createRuntime as createDSLRuntime } from '../dsl/runtime';
import { RetryPolicy } from '../dsl/types';

// Import LangChain components
// Note: We're using a simplified implementation for testing
// In a real implementation, you would use the actual LangChain components

// Define Document type
interface Document {
  pageContent: string;
  metadata: Record<string, any>;
}

// Define a simplified Chroma class for vector storage
class Chroma {
  private documents: Document[] = [];
  private embeddings: any;
  private collectionName: string;

  constructor(embeddings: any, options: { collectionName: string }) {
    this.embeddings = embeddings;
    this.collectionName = options.collectionName;
  }

  static async fromDocuments(documents: Document[], embeddings: any, options: { collectionName: string }): Promise<Chroma> {
    const chroma = new Chroma(embeddings, options);
    chroma.documents = documents;
    return chroma;
  }

  async similaritySearch(query: string, k: number): Promise<Document[]> {
    // In a real implementation, this would perform a similarity search
    // For now, just return the first k documents
    return this.documents.slice(0, k);
  }
}

// Define OpenAIEmbeddings class
class OpenAIEmbeddings {
  private apiKey: string;
  private modelName: string;

  constructor(options: { openAIApiKey?: string; modelName?: string }) {
    this.apiKey = options.openAIApiKey || '';
    this.modelName = options.modelName || 'text-embedding-ada-002';
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    // In a real implementation, this would call the OpenAI API
    // For now, just return dummy embeddings
    return texts.map((_: string) => new Array(1536).fill(0.1));
  }

  async embedQuery(text: string): Promise<number[]> {
    // In a real implementation, this would call the OpenAI API
    // For now, just return dummy embeddings
    return new Array(1536).fill(0.1);
  }
}

// Define ChatOpenAI class
class ChatOpenAI {
  private apiKey: string;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;
  private debug: boolean;
  private baseUrl: string;

  constructor(options: { openAIApiKey?: string; modelName?: string; temperature?: number; maxTokens?: number; debug?: boolean; baseUrl?: string }) {
    this.apiKey = options.openAIApiKey || '';
    this.modelName = options.modelName || 'meta-llama/llama-3.2-1b-instruct:free';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 4000;
    this.debug = options.debug || false;
    this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1';
  }

  async invoke(messages: any[]): Promise<{ content: string }> {
    // Make a real API call to OpenRouter
    try {
      if (this.debug) {
        console.log(`Making API call to OpenRouter with model: ${this.modelName}`);
        console.log(`API Key (first 5 chars): ${this.apiKey.substring(0, 5)}...`);
        console.log(`Number of messages: ${messages.length}`);
      }

      const url = `${this.baseUrl}/chat/completions`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://architectlm.com', // Replace with your actual domain
        'X-Title': 'ArchitectLM Implementation Generator'
      };
      const data = {
        model: this.modelName,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: this.temperature,
        max_tokens: this.maxTokens
      };
      
      if (this.debug) {
        console.log('Request payload:', JSON.stringify({
          model: this.modelName,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
          }))
        }, null, 2));
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`);
      }
      
      const result = await response.json();
      
      if (this.debug) {
        console.log('Response received from OpenRouter API');
        console.log('First 100 chars of response:', result.choices[0].message.content.substring(0, 100) + '...');
      }
      
      return { content: result.choices[0].message.content };
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw error;
    }
  }
}

// Define message classes
class SystemMessage {
  role = 'system';
  content: string;

  constructor(content: string) {
    this.content = content;
  }
}

class HumanMessage {
  role = 'human';
  content: string;

  constructor(content: string) {
    this.content = content;
  }
}

// Define text splitter class
class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: { chunkSize: number; chunkOverlap: number }) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    // In a real implementation, this would split documents into chunks
    // For now, just return the original documents
    return documents;
  }
}

// Define directory loader class
class DirectoryLoader {
  private path: string;
  private loaders: Record<string, (path: string) => TextLoader>;

  constructor(path: string, loaders: Record<string, (path: string) => TextLoader>) {
    this.path = path;
    this.loaders = loaders;
  }

  async load(): Promise<Document[]> {
    // In a real implementation, this would load documents from a directory
    // For now, just return dummy documents
    return [
      {
        pageContent: 'const orderProcess = Process.create("order-process")\n  .withDescription("Handles order processing")\n  .withInitialState("created")\n  .addState("created")\n  .addState("processing")\n  .addState("completed")\n  .addState("cancelled")\n  .addTransition({\n    from: "created",\n    to: "processing",\n    on: "START_PROCESSING"\n  })',
        metadata: { source: 'examples/order-processing.ts' }
      },
      {
        pageContent: 'const processOrderTask = Task.create("process-order")\n  .withDescription("Processes an order")\n  .withImplementation(async (input, context) => {\n    // Process the order\n    context.emitEvent("COMPLETE", { orderId: input.orderId });\n    return { processed: true };\n  })',
        metadata: { source: 'examples/order-processing.ts' }
      }
    ];
  }
}

// Define text loader class
class TextLoader {
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  async load(): Promise<Document[]> {
    // In a real implementation, this would load text from a file
    // For now, just return dummy documents
    return [
      {
        pageContent: '// Mock file content',
        metadata: { source: this.path }
      }
    ];
  }
}

// Import Node.js modules
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for the RAG Agent extension
 */
export interface RAGAgentConfig {
  /**
   * The LLM provider to use
   */
  provider: 'openai' | 'anthropic' | 'local' | 'custom' | 'openrouter';
  
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
   * Path to the codebase to index
   */
  codebasePath?: string;
  
  /**
   * Whether to use in-memory vector store (for testing)
   */
  useInMemoryVectorStore?: boolean;
  
  /**
   * Enable debug mode for additional logging and recovery attempts
   */
  debug?: boolean;
  
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
 * Default configuration for the RAG Agent extension
 */
const DEFAULT_CONFIG: RAGAgentConfig = {
  provider: 'openrouter',
  model: 'meta-llama/llama-3.2-1b-instruct:free',
  temperature: 0.7,
  maxTokens: 4000,
  codebasePath: './src',
  useInMemoryVectorStore: false,
  debug: false,
  baseUrl: 'https://openrouter.ai/api/v1',
  systemPrompt: `You are an expert software architect and full-stack developer specializing in TypeScript, React, Express, and MongoDB.
Your task is to help design and implement high-quality, production-ready code for the ArchitectLM framework.

When generating code, follow these principles:
1. Write clean, maintainable code with proper TypeScript typing
2. Follow best practices for the specific technology (React, Express, MongoDB, etc.)
3. Implement proper error handling and validation
4. Include comprehensive comments and documentation
5. Consider security, performance, and accessibility
6. Follow the Single Responsibility Principle and other SOLID principles
7. Make the code testable and extensible

Your code should be ready to run with minimal modifications and should integrate well with existing codebases.`
};

/**
 * RAG-Enhanced Agent Extension implementation
 */
export class RAGAgentExtension implements Extension, ArchitectAgent {
  name = 'rag-agent';
  private config: RAGAgentConfig;
  private runtime?: Runtime;
  private vectorStore?: Chroma;
  private embeddings: OpenAIEmbeddings;
  private llm: ChatOpenAI;
  
  constructor(config: Partial<RAGAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize OpenAI embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: 'text-embedding-ada-002'
    });
    
    // Initialize LLM
    this.llm = new ChatOpenAI({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      debug: this.config.debug,
      baseUrl: this.config.baseUrl
    });
  }
  
  /**
   * Initialize the extension with the runtime
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    
    // Register this extension as a service
    runtime.registerService('rag-agent', this);
    
    // Index the codebase
    await this.indexCodebase();
    
    console.log(`RAG Agent extension initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
  }
  
  /**
   * Index the codebase for retrieval
   */
  private async indexCodebase(): Promise<void> {
    try {
      console.log(`Indexing codebase at: ${this.config.codebasePath}`);
      
      // Load documents from the codebase
      const loader = new DirectoryLoader(
        this.config.codebasePath || './src',
        {
          '.ts': (path) => new TextLoader(path),
          '.tsx': (path) => new TextLoader(path),
          '.js': (path) => new TextLoader(path),
          '.jsx': (path) => new TextLoader(path),
          '.md': (path) => new TextLoader(path)
        }
      );
      
      const docs = await loader.load();
      console.log(`Loaded ${docs.length} documents from codebase`);
      
      // Split documents into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
      });
      
      const splitDocs = await textSplitter.splitDocuments(docs);
      console.log(`Split into ${splitDocs.length} chunks`);
      
      // Create vector store
      this.vectorStore = await Chroma.fromDocuments(
        splitDocs,
        this.embeddings,
        {
          collectionName: 'architectlm-codebase'
        }
      );
      
      console.log('Codebase indexed successfully');
    } catch (error: unknown) {
      console.error('Error indexing codebase:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to index codebase: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a process definition from a specification
   */
  async generateProcess(spec: ProcessSpec): Promise<ProcessDefinition> {
    console.log(`Generating process: ${spec.name}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(spec, 'process');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createDSLProcessPrompt(spec, relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Extract the code from the response
      const processCode = this.extractCodeFromResponse(response.content, 'typescript');
      
      if (!processCode) {
        throw new Error('Failed to extract process code from response');
      }
      
      // Create a temporary function to evaluate the code and get the process
      const createProcessFn = new Function(
        'ReactiveSystem',
        `
        ${processCode}
        return process;
        `
      );
      
      // Execute the function to get the process
      const process = createProcessFn(ReactiveSystem);
      
      if (!process) {
        throw new Error('Failed to create process from generated code');
      }
      
      // Convert the DSL process to a ProcessDefinition
      const processDefinition = this.convertDSLProcessToDefinition(process);
      
      return processDefinition;
    } catch (error: unknown) {
      console.error('Failed to generate process definition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Fallback to JSON parsing if code execution fails
      try {
        console.log('Attempting to parse response as JSON...');
        const processDefinition = JSON.parse(response.content);
        return processDefinition;
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        throw new Error(`Failed to generate process definition: ${errorMessage}`);
      }
    }
  }
  
  /**
   * Generate a task definition from a specification
   */
  async generateTask(spec: TaskSpec): Promise<TaskDefinition> {
    console.log(`Generating task: ${spec.name}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(spec, 'task');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = this.createDSLTaskPrompt(spec, relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Extract the code from the response
      const taskCode = this.extractCodeFromResponse(response.content, 'typescript');
      
      if (!taskCode) {
        throw new Error('Failed to extract task code from response');
      }
      
      // Create a temporary function to evaluate the code and get the task
      const createTaskFn = new Function(
        'ReactiveSystem',
        `
        ${taskCode}
        return task;
        `
      );
      
      // Execute the function to get the task
      const task = createTaskFn(ReactiveSystem);
      
      if (!task) {
        throw new Error('Failed to create task from generated code');
      }
      
      // Convert the DSL task to a TaskDefinition
      const taskDefinition = this.convertDSLTaskToDefinition(task);
      
      return taskDefinition;
    } catch (error: unknown) {
      console.error('Failed to generate task definition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Fallback to JSON parsing if code execution fails
      try {
        console.log('Attempting to parse response as JSON...');
        const taskDefinition = JSON.parse(response.content);
        return taskDefinition;
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        throw new Error(`Failed to generate task definition: ${errorMessage}`);
      }
    }
  }
  
  /**
   * Generate a system configuration from a specification
   */
  async generateSystem(spec: SystemSpec): Promise<SystemConfig> {
    console.log(`Generating system: ${spec.name}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(spec, 'system');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(spec, 'system', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const systemConfig = JSON.parse(response.content);
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
    
    // Create enhanced prompt with feedback
    const enhancedPrompt = this.createFeedbackPrompt(feedback);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const fixes = JSON.parse(response.content);
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
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(component, 'test');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(component, 'test', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const tests = JSON.parse(response.content);
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
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(component, 'documentation');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(component, 'documentation', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    return response.content;
  }
  
  /**
   * Generate a database schema from a specification
   * @param schemaSpec The database schema specification
   * @returns The generated database schema definition
   */
  async generateDatabaseSchema(schemaSpec: DatabaseSchemaSpec): Promise<DatabaseSchemaDefinition> {
    console.log(`Generating database schema: ${schemaSpec.name}`);
    
    // Validate input
    if (!schemaSpec.name) {
      throw new Error('Database schema name is required');
    }
    
    if (!schemaSpec.fields || !Array.isArray(schemaSpec.fields) || schemaSpec.fields.length === 0) {
      throw new Error('Database schema must have at least one field');
    }
    
    // Validate each field
    for (const field of schemaSpec.fields) {
      if (!field.name) {
        throw new Error('Each field must have a name');
      }
      if (!field.type) {
        throw new Error(`Field ${field.name} must have a type`);
      }
    }
    
    try {
      // Retrieve relevant examples
      console.log('Retrieving relevant examples from codebase...');
      const relevantExamples = await this.retrieveRelevantExamples(schemaSpec, 'database-schema');
      console.log(`Found ${relevantExamples.length} relevant examples`);
      
      // Create enhanced prompt with examples
      console.log('Creating enhanced prompt...');
      const enhancedPrompt = await this.createDatabaseSchemaPrompt(schemaSpec, relevantExamples);
      
      // Generate with enhanced prompt
      console.log('Generating schema with LLM...');
      const response = await this.llm.invoke([
        new SystemMessage(this.config.systemPrompt || ''),
        new HumanMessage(enhancedPrompt)
      ]);
      
      // Parse the response
      console.log('Extracting code from response...');
      const schemaDefinition = this.extractCodeFromResponse(response.content, 'typescript');
      
      // Validate the generated code
      if (!schemaDefinition || schemaDefinition.trim().length === 0) {
        throw new Error('Generated schema is empty');
      }
      
      // Check for basic TypeScript syntax
      if (!schemaDefinition.includes('interface') && !schemaDefinition.includes('type') && !schemaDefinition.includes('class')) {
        console.warn('Generated schema may not contain proper TypeScript definitions');
      }
      
      // Check for Mongoose schema
      if (!schemaDefinition.includes('mongoose') || !schemaDefinition.includes('Schema')) {
        console.warn('Generated schema may not contain proper Mongoose schema definition');
      }
      
      console.log('Database schema generated successfully');
      
      return {
        name: schemaSpec.name,
        description: schemaSpec.description,
        fields: schemaSpec.fields,
        code: schemaDefinition
      };
    } catch (error: unknown) {
      console.error('Failed to generate database schema:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Attempt to recover with a simpler prompt if possible
      if (this.config.debug) {
        console.log('Attempting to recover with a simpler prompt...');
        try {
          const simplePrompt = `
Generate a TypeScript file with a Mongoose schema for a ${schemaSpec.name} model with these fields:
${schemaSpec.fields.map((f: { name: string; type: string; required?: boolean }) => 
  `- ${f.name}: ${f.type}${f.required ? ' (required)' : ''}`
).join('\n')}

Include a TypeScript interface and Mongoose model export.
`;
          
          const simpleResponse = await this.llm.invoke([
            new SystemMessage('You are an expert TypeScript and MongoDB developer.'),
            new HumanMessage(simplePrompt)
          ]);
          
          const simpleSchemaDefinition = this.extractCodeFromResponse(simpleResponse.content, 'typescript');
          
          if (simpleSchemaDefinition && simpleSchemaDefinition.trim().length > 0) {
            console.log('Recovery successful, generated a simpler schema');
            return {
              name: schemaSpec.name,
              description: schemaSpec.description,
              fields: schemaSpec.fields,
              code: simpleSchemaDefinition
            };
          }
        } catch (recoveryError) {
          console.error('Recovery attempt failed:', recoveryError);
        }
      }
      
      throw new Error(`Failed to generate database schema: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a database model file from a schema definition
   * @param modelDefinition The database model definition
   * @param outputPath The path to write the file to
   * @returns The path to the generated file
   */
  async generateDatabaseModelFile(modelDefinition: any, outputPath: string): Promise<string> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write code to file
      await fs.writeFile(outputPath, modelDefinition.code);
      
      return outputPath;
    } catch (error: unknown) {
      console.error('Failed to generate database model file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate database model file: ${errorMessage}`);
    }
  }
  
  /**
   * Generate an API endpoint from a specification
   * @param endpointSpec The API endpoint specification
   * @returns The generated API endpoint definition
   */
  async generateAPIEndpoint(endpointSpec: APIEndpointSpec): Promise<APIEndpointDefinition> {
    console.log(`Generating API endpoint: ${endpointSpec.name}`);
    
    // Validate input
    if (!endpointSpec.name) {
      throw new Error('API endpoint name is required');
    }
    
    if (!endpointSpec.model) {
      throw new Error('API endpoint model is required');
    }
    
    if (!endpointSpec.operations || !Array.isArray(endpointSpec.operations) || endpointSpec.operations.length === 0) {
      throw new Error('API endpoint must have at least one operation');
    }
    
    try {
      // Retrieve relevant examples
      console.log('Retrieving relevant examples from codebase...');
      const relevantExamples = await this.retrieveRelevantExamples(endpointSpec, 'api-endpoint');
      console.log(`Found ${relevantExamples.length} relevant examples`);
      
      // Create enhanced prompt with examples
      console.log('Creating enhanced prompt...');
      const enhancedPrompt = await this.createAPIEndpointPrompt(endpointSpec, relevantExamples);
      
      // Generate with enhanced prompt
      console.log('Generating API endpoint with LLM...');
      const response = await this.llm.invoke([
        new SystemMessage(this.config.systemPrompt || ''),
        new HumanMessage(enhancedPrompt)
      ]);
      
      // Parse the response
      console.log('Extracting code from response...');
      const endpointDefinition = this.extractCodeFromResponse(response.content, 'typescript');
      
      // Validate the generated code
      if (!endpointDefinition || endpointDefinition.trim().length === 0) {
        throw new Error('Generated API endpoint is empty');
      }
      
      // Check for basic Express router setup
      if (!endpointDefinition.includes('express') || !endpointDefinition.includes('Router')) {
        console.warn('Generated API endpoint may not contain proper Express router setup');
      }
      
      // Check for route handlers
      const missingOperations = endpointSpec.operations.filter((op: string) => {
        const typedDefinition = endpointDefinition as unknown as { operations: Array<{ name: string }> };
        return !typedDefinition.operations || !typedDefinition.operations.some((impl: { name: string }) => impl.name === op);
      });
      
      if (missingOperations.length > 0) {
        console.warn(`Generated API endpoint may be missing handlers for: ${missingOperations.join(', ')}`);
      }
      
      console.log('API endpoint generated successfully');
      
      // Parse operations from the endpoint spec
      const operations = endpointSpec.operations.map((name: string) => {
        let method = 'get';
        if (name.startsWith('create')) method = 'post';
        if (name.startsWith('update')) method = 'put';
        if (name.startsWith('delete')) method = 'delete';
        if (name.startsWith('patch')) method = 'patch';
        
        return {
          name,
          method: method as 'get' | 'post' | 'put' | 'delete' | 'patch',
          path: name === 'list' ? '/' : 
                name === 'read' ? '/:id' : 
                name.startsWith('create') ? '/' :
                name.startsWith('update') || name.startsWith('delete') || name.startsWith('patch') ? '/:id' :
                `/${name.toLowerCase()}`,
          handler: `${name}${endpointSpec.model}`
        };
      });
      
      return {
        name: endpointSpec.name,
        description: endpointSpec.description,
        model: endpointSpec.model,
        operations,
        code: endpointDefinition
      };
    } catch (error: unknown) {
      console.error('Failed to generate API endpoint:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Attempt to recover with a simpler prompt if possible
      if (this.config.debug) {
        console.log('Attempting to recover with a simpler prompt...');
        try {
          const simplePrompt = `
Generate an Express router TypeScript file for a ${endpointSpec.model} API with these operations:
${endpointSpec.operations.map((op: string) => `- ${op}`).join('\n')}

Include proper error handling and TypeScript types.
`;
          
          const simpleResponse = await this.llm.invoke([
            new SystemMessage('You are an expert TypeScript and Express developer.'),
            new HumanMessage(simplePrompt)
          ]);
          
          const simpleEndpointDefinition = this.extractCodeFromResponse(simpleResponse.content, 'typescript');
          
          if (simpleEndpointDefinition && simpleEndpointDefinition.trim().length > 0) {
            console.log('Recovery successful, generated a simpler API endpoint');
            
            // Parse operations from the endpoint spec
            const operations = endpointSpec.operations.map((name: string) => {
              let method = 'get';
              if (name.startsWith('create')) method = 'post';
              if (name.startsWith('update')) method = 'put';
              if (name.startsWith('delete')) method = 'delete';
              
              return {
                name,
                method: method as 'get' | 'post' | 'put' | 'delete' | 'patch',
                path: name === 'list' ? '/' : name === 'read' ? '/:id' : `/${name.toLowerCase()}`,
                handler: `${name}${endpointSpec.model}`
              };
            });
            
            return {
              name: endpointSpec.name,
              description: endpointSpec.description,
              model: endpointSpec.model,
              operations,
              code: simpleEndpointDefinition
            };
          }
        } catch (recoveryError) {
          console.error('Recovery attempt failed:', recoveryError);
        }
      }
      
      throw new Error(`Failed to generate API endpoint: ${errorMessage}`);
    }
  }
  
  /**
   * Generate an API endpoint file from an endpoint definition
   * @param endpointDefinition The API endpoint definition
   * @param outputPath The path to write the file to
   * @returns The path to the generated file
   */
  async generateAPIEndpointFile(endpointDefinition: any, outputPath: string): Promise<string> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write code to file
      await fs.writeFile(outputPath, endpointDefinition.code);
      
      return outputPath;
    } catch (error: unknown) {
      console.error('Failed to generate API endpoint file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate API endpoint file: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a UI component from a specification
   * @param componentSpec The UI component specification
   * @returns The generated UI component definition
   */
  async generateUIComponent(componentSpec: UIComponentSpec): Promise<UIComponentDefinition> {
    console.log(`Generating UI component: ${componentSpec.name}`);
    
    // Validate input
    if (!componentSpec.name) {
      throw new Error('UI component name is required');
    }
    
    if (!componentSpec.framework) {
      throw new Error('UI component framework is required');
    }
    
    if (!componentSpec.props || !Array.isArray(componentSpec.props)) {
      throw new Error('UI component props must be an array');
    }
    
    // Validate each prop
    for (const prop of componentSpec.props) {
      if (!prop.name) {
        throw new Error('Each prop must have a name');
      }
      if (!prop.type) {
        throw new Error(`Prop ${prop.name} must have a type`);
      }
    }
    
    try {
      // Retrieve relevant examples
      console.log('Retrieving relevant examples from codebase...');
      const relevantExamples = await this.retrieveRelevantExamples(componentSpec, 'ui-component');
      console.log(`Found ${relevantExamples.length} relevant examples`);
      
      // Create enhanced prompt with examples
      console.log('Creating enhanced prompt...');
      const enhancedPrompt = await this.createUIComponentPrompt(componentSpec, relevantExamples);
      
      // Generate with enhanced prompt
      console.log('Generating UI component with LLM...');
      const response = await this.llm.invoke([
        new SystemMessage(this.config.systemPrompt || ''),
        new HumanMessage(enhancedPrompt)
      ]);
      
      // Parse the response
      console.log('Extracting code from response...');
      const componentDefinition = this.extractCodeFromResponse(response.content, 'tsx');
      
      // Validate the generated code
      if (!componentDefinition || componentDefinition.trim().length === 0) {
        throw new Error('Generated UI component is empty');
      }
      
      // Check for React component
      if (componentSpec.framework === 'react' && 
          (!componentDefinition.includes('React') || 
           !componentDefinition.includes('function') || 
           !componentDefinition.includes('return'))) {
        console.warn('Generated UI component may not be a valid React component');
      }
      
      // Check for TypeScript interfaces
      if (!componentDefinition.includes('interface') && !componentDefinition.includes('type ')) {
        console.warn('Generated UI component may not have proper TypeScript type definitions');
      }
      
      // Check for props usage
      const missingProps = componentSpec.props.filter((prop: { name: string; type: string; required?: boolean }) => {
        const typedDefinition = componentDefinition as unknown as { props: Array<{ name: string }> };
        return !typedDefinition.props || !typedDefinition.props.some((p: { name: string }) => p.name === prop.name);
      });
      
      if (missingProps.length > 0) {
        console.warn(`Generated UI component may be missing usage of props: ${missingProps.map((p: { name: string }) => p.name).join(', ')}`);
      }
      
      console.log('UI component generated successfully');
      
      return {
        name: componentSpec.name,
        description: componentSpec.description,
        props: componentSpec.props,
        code: componentDefinition
      };
    } catch (error: unknown) {
      console.error('Failed to generate UI component:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Attempt to recover with a simpler prompt if possible
      if (this.config.debug) {
        console.log('Attempting to recover with a simpler prompt...');
        try {
          const simplePrompt = `
Generate a ${componentSpec.framework} component named ${componentSpec.name} with these props:
${componentSpec.props.map((p: { name: string; type: string; required?: boolean }) => `- ${p.name}: ${p.type}${p.required ? ' (required)' : ''}`).join('\n')}

Include TypeScript interfaces and proper error handling.
`;
          
          const simpleResponse = await this.llm.invoke([
            new SystemMessage(`You are an expert ${componentSpec.framework} and TypeScript developer.`),
            new HumanMessage(simplePrompt)
          ]);
          
          const simpleComponentDefinition = this.extractCodeFromResponse(simpleResponse.content, 'tsx');
          
          if (simpleComponentDefinition && simpleComponentDefinition.trim().length > 0) {
            console.log('Recovery successful, generated a simpler UI component');
            return {
              name: componentSpec.name,
              description: componentSpec.description,
              props: componentSpec.props,
              code: simpleComponentDefinition
            };
          }
        } catch (recoveryError) {
          console.error('Recovery attempt failed:', recoveryError);
        }
      }
      
      throw new Error(`Failed to generate UI component: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a UI component file from a component definition
   * @param componentDefinition The UI component definition
   * @param outputPath The path to write the file to
   * @returns The path to the generated file
   */
  async generateUIComponentFile(componentDefinition: any, outputPath: string): Promise<string> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write code to file
      await fs.writeFile(outputPath, componentDefinition.code);
      
      return outputPath;
    } catch (error: unknown) {
      console.error('Failed to generate UI component file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate UI component file: ${errorMessage}`);
    }
  }
  
  /**
   * Retrieve relevant examples from the codebase
   */
  async retrieveRelevantExamples(spec: any, type: string): Promise<Document[]> {
    if (!this.vectorStore) {
      console.warn('Vector store not initialized, skipping retrieval');
      return [];
    }
    
    try {
      // Create a search query based on the spec and type
      const query = this.createSearchQuery(spec, type);
      
      // Retrieve relevant documents
      const documents = await this.vectorStore.similaritySearch(query, 3);
      
      return documents;
    } catch (error: unknown) {
      console.error('Error retrieving examples:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to retrieve examples: ${errorMessage}`);
      return [];
    }
  }
  
  /**
   * Create a search query based on the spec and type
   */
  private createSearchQuery(spec: any, type: string): string {
    let query = '';
    
    switch (type) {
      case 'process':
        query = `Process definition for ${spec.name}: ${spec.description || ''}`;
        if (spec.states) {
          query += ` States: ${spec.states.join(', ')}`;
        }
        if (spec.events) {
          query += ` Events: ${spec.events.join(', ')}`;
        }
        break;
        
      case 'task':
        query = `Task implementation for ${spec.name}: ${spec.description || ''}`;
        if (spec.input) {
          query += ` Input: ${JSON.stringify(spec.input)}`;
        }
        if (spec.output) {
          query += ` Output: ${JSON.stringify(spec.output)}`;
        }
        break;
        
      case 'system':
        query = `System configuration for ${spec.name}: ${spec.description || ''}`;
        break;
        
      case 'test':
        query = `Tests for ${spec.id}: ${spec.description || ''}`;
        break;
        
      case 'documentation':
        query = `Documentation for ${spec.id}: ${spec.description || ''}`;
        break;
        
      case 'database-schema':
        query = `Database schema for ${spec.name}: ${spec.description || ''}`;
        if (spec.fields) {
          query += ` Fields: ${spec.fields.map((field: { name: string; type: string; required?: boolean }) => field.name).join(', ')}`;
        }
        break;
        
      case 'api-endpoint':
        query = `API endpoint for ${spec.name}: ${spec.description || ''}`;
        if (spec.operations) {
          query += ` Operations: ${spec.operations.join(', ')}`;
        }
        if (spec.model) {
          query += ` Model: ${spec.model}`;
        }
        break;
        
      case 'ui-component':
        query = `UI component for ${spec.name}: ${spec.description || ''}`;
        if (spec.props) {
          query += ` Props: ${spec.props.map((prop: { name: string; type: string; required?: boolean }) => prop.name).join(', ')}`;
        }
        if (spec.framework) {
          query += ` Framework: ${spec.framework}`;
        }
        break;
        
      default:
        query = `${type} for ${JSON.stringify(spec)}`;
    }
    
    return query;
  }
  
  /**
   * Create an enhanced prompt with examples
   */
  async createEnhancedPrompt(spec: any, type: string, examples: Document[] = []): Promise<string> {
    let basePrompt = '';
    
    // Get the base prompt template based on the type
    switch (type) {
      case 'process':
        basePrompt = this.createDSLProcessPrompt(spec, examples);
        break;
        
      case 'task':
        basePrompt = this.createDSLTaskPrompt(spec, examples);
        break;
        
      case 'system':
        basePrompt = this.createSystemPrompt(spec);
        break;
        
      case 'test':
        basePrompt = this.createTestPrompt(spec);
        break;
        
      case 'documentation':
        basePrompt = this.createDocumentationPrompt(spec);
        break;
        
      case 'database-schema':
        basePrompt = this.createDatabaseSchemaPrompt(spec);
        break;
        
      case 'api-endpoint':
        basePrompt = this.createAPIEndpointPrompt(spec);
        break;
        
      case 'ui-component':
        basePrompt = this.createUIComponentPrompt(spec);
        break;
        
      default:
        basePrompt = `Generate a ${type} for: ${JSON.stringify(spec, null, 2)}`;
    }
    
    // If no examples, return the base prompt
    if (examples.length === 0) {
      return basePrompt;
    }
    
    // Add examples to the prompt
    let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
    
    examples.forEach((example, index) => {
      examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`typescript\n${example.pageContent}\n\`\`\`\n\n`;
    });
    
    // Add guidance on how to use the examples
    examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

Now, please generate the ${type} according to the specification above.
Return ONLY the JSON object representing the ${type === 'process' ? 'ProcessDefinition' : type === 'task' ? 'TaskDefinition' : type === 'system' ? 'SystemConfig' : 'TestDefinition'}.
`;
    
    return basePrompt + examplesText;
  }
  
  /**
   * Create a DSL-specific prompt for generating a process
   */
  private createDSLProcessPrompt(spec: ProcessSpec, examples: Document[] = []): string {
    const template = `
You are designing a process for a reactive system using the ArchitectLM framework with our Reactive System DSL.

Process Specification:
- Name: ${spec.name}
- Description: ${spec.description || ''}
${spec.domainConcepts ? `- Domain Concepts: ${spec.domainConcepts.join(', ')}` : ''}
${spec.businessRules ? `- Business Rules: ${spec.businessRules.join(', ')}` : ''}
${spec.states ? `- States: ${spec.states.join(', ')}` : ''}
${spec.events ? `- Events: ${spec.events.join(', ')}` : ''}

Create a complete process definition using our Reactive System DSL.
Use the following pattern:

\`\`\`typescript
// Import the ReactiveSystem if needed
// const { Process } = ReactiveSystem;

// Define the process
const process = ReactiveSystem.Process.create("${spec.name.toLowerCase().replace(/\s+/g, '-')}")
  .withDescription("${spec.description || ''}")
  .withInitialState("${spec.states && spec.states.length > 0 ? spec.states[0] : 'initial'}")
  ${spec.states && spec.states.length > 0 ? spec.states.map((state: string) => `\n  .addState("${state}")`).join('') : ''}
  ${spec.events && spec.events.length > 0 && spec.states && spec.states.length > 0 ? 
    spec.events.map((event: string, index: number) => {
      const fromState = spec.states![Math.min(index, spec.states!.length - 1)];
      const toState = spec.states![Math.min(index + 1, spec.states!.length - 1)];
      return `\n  .addTransition({\n    from: "${fromState}",\n    to: "${toState}",\n    on: "${event}"\n  })`;
    }).join('') : ''}
  // Add more states and transitions as needed
\`\`\`

The process should include:
1. A unique ID based on the process name
2. All the states specified in the requirements
3. Transitions between states with appropriate event triggers
4. Guards and actions for transitions where appropriate

Return ONLY the TypeScript code that defines the process using our DSL.
`;

    // If no examples, return the base prompt
    if (examples.length === 0) {
      return template;
    }

    // Add examples to the prompt
    let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
    
    examples.forEach((example, index) => {
      examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`typescript\n${example.pageContent}\n\`\`\`\n\n`;
    });
    
    // Add guidance on how to use the examples
    examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

Now, please generate the process according to the specification above.
Return ONLY the TypeScript code that defines the process using our DSL.
`;
    
    return template + examplesText;
  }

  /**
   * Convert a DSL process to a ProcessDefinition
   */
  private convertDSLProcessToDefinition(process: any): ProcessDefinition {
    // Extract the process definition from the DSL process
    const id = process.id;
    const description = process.description;
    const initialState = process.initialState;
    
    // Convert states
    const states: Record<string, any> = {};
    process.states.forEach((state: any) => {
      states[state.name] = {
        name: state.name,
        description: state.description || '',
        type: state.name === initialState ? 'initial' : (state.isFinal ? 'final' : 'normal')
      };
    });
    
    // Convert transitions
    const transitions = process.transitions.map((transition: {
      from: string | string[];
      to: string;
      on: string;
      guard?: Function;
      action?: Function;
    }) => {
      return {
        from: Array.isArray(transition.from) ? transition.from : [transition.from],
        to: transition.to,
        on: transition.on,
        guard: transition.guard,
        action: transition.action
      };
    });
    
    // Create the ProcessDefinition
    return {
      id,
      description,
      states,
      initialState,
      transitions,
      metadata: process.metadata || {}
    };
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
   * Create a DSL-specific prompt for generating a task
   */
  private createDSLTaskPrompt(spec: TaskSpec, examples: Document[] = []): string {
    const template = `
You are designing a task for a reactive system using the ArchitectLM framework with our Reactive System DSL.

Task Specification:
- Name: ${spec.name}
- Description: ${spec.description || ''}
${spec.input ? `- Input: ${JSON.stringify(spec.input)}` : ''}
${spec.output ? `- Output: ${JSON.stringify(spec.output)}` : ''}
${spec.dependencies ? `- Dependencies: ${spec.dependencies.join(', ')}` : ''}

Create a complete task definition using our Reactive System DSL.
Use the following pattern:

\`\`\`typescript
// Import the ReactiveSystem if needed
// const { Task } = ReactiveSystem;

// Define the task
const task = ReactiveSystem.Task.create("${spec.name.toLowerCase().replace(/\s+/g, '-')}")
  .withDescription("${spec.description || ''}")
  ${spec.input ? `.withInputSchema(z.object({
    ${Object.entries(spec.input).map(entry => {
      const key = entry[0];
      const type = entry[1] as string;
      return `${key}: z.${type.toLowerCase()}`;
    }).join(',\n    ')}
  }))` : ''}
  ${spec.output ? `.withOutputSchema(z.object({
    ${Object.entries(spec.output).map(entry => {
      const key = entry[0];
      const type = entry[1] as string;
      return `${key}: z.${type.toLowerCase()}`;
    }).join(',\n    ')}
  }))` : ''}
  .withImplementation(async (input, context) => {
    // Implement the task logic here
    console.log("Executing task: ${spec.name}");
    
    // Example implementation
    ${spec.output ? `return {
      ${Object.keys(spec.output).map(key => `${key}: ${this.getDefaultValueForType(spec.output![key])}`).join(',\n      ')}
    };` : 'return { success: true };'}
  })
  .withRetry({
    maxAttempts: 3,
    delay: 1000
  });
\`\`\`

The task should include:
1. A unique ID based on the task name
2. A clear description of what the task does
3. Input and output schemas using Zod for validation
4. A proper implementation function that performs the task
5. Appropriate error handling
6. Retry configuration for transient failures

Return ONLY the TypeScript code that defines the task using our DSL.
`;

    // If no examples, return the base prompt
    if (examples.length === 0) {
      return template;
    }

    // Add examples to the prompt
    let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
    
    examples.forEach((example, index) => {
      examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`typescript\n${example.pageContent}\n\`\`\`\n\n`;
    });
    
    // Add guidance on how to use the examples
    examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

Now, please generate the task according to the specification above.
Return ONLY the TypeScript code that defines the task using our DSL.
`;
    
    return template + examplesText;
  }
  
  /**
   * Get a default value for a given type
   */
  private getDefaultValueForType(type: string): string {
    switch (type.toLowerCase()) {
      case 'string':
        return '"example"';
      case 'number':
        return '42';
      case 'boolean':
        return 'true';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return 'null';
    }
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
      .replace('{{validation}}', JSON.stringify(feedback.validation || {}))
      .replace('{{tests}}', JSON.stringify(feedback.tests || {}))
      .replace('{{staticAnalysis}}', JSON.stringify(feedback.staticAnalysis || {}));
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
   * Create a prompt for generating a database schema
   */
  private createDatabaseSchemaPrompt(spec: any, examples: Document[] = []): string {
    const template = `
You are designing a database schema for a ${spec.name} using TypeScript and Mongoose.

Schema Specification:
- Name: ${spec.name}
- Description: ${spec.description || ''}
- Fields:
${spec.fields.map((field: { name: string; type: string; required?: boolean; default?: any }) =>
  `  - ${field.name}: ${field.type}${field.required ? ' (required)' : ''}${field.default ? ` (default: ${field.default})` : ''}`
).join('\n')}
${spec.timestamps ? '- Timestamps: true (include createdAt and updatedAt fields)' : ''}
${spec.indexes && spec.indexes.length > 0 ? `- Indexes: ${JSON.stringify(spec.indexes)}` : ''}

Create a complete TypeScript file that implements this schema.
The file should include:
1. A TypeScript interface for the model with proper JSDoc comments
2. A Mongoose schema definition with proper validation
3. The Mongoose model export with correct typing

Use best practices for MongoDB and Mongoose, including:
- Proper field validation with meaningful error messages
- Appropriate indexes for performance optimization
- Type safety with TypeScript (use strict typing)
- Timestamps for created/updated fields
- Proper error handling in schema methods
- Consistent naming conventions (camelCase for fields, PascalCase for model names)
- Security considerations (no storing of sensitive data in plain text)
- Performance considerations (avoid deeply nested structures)

IMPORTANT GUIDELINES:
- Follow the Single Responsibility Principle
- Use proper TypeScript typing (avoid 'any' type)
- Add JSDoc comments for all interfaces, methods, and complex properties
- Implement proper validation for all fields
- Use Mongoose middleware where appropriate (e.g., for data transformation)
- Ensure the schema is extensible for future requirements
- Include proper error handling for database operations

Return ONLY the TypeScript code for the schema file.
`;

    // Add examples if provided
    if (examples.length > 0) {
      let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
      
      examples.forEach((example, index) => {
        examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`typescript\n${example.pageContent}\n\`\`\`\n\n`;
      });
      
      examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

IMPORTANT: Analyze the examples carefully to understand:
1. The project's coding style and conventions
2. How error handling is implemented
3. How validation is structured
4. How types are defined and used
5. How documentation is written

Now, please generate the database schema according to the specification above.
Return ONLY the TypeScript code for the schema file.
`;
      
      return template + examplesText;
    }
    
    return template;
  }
  
  /**
   * Create a prompt for generating an API endpoint
   */
  private createAPIEndpointPrompt(spec: any, examples: Document[] = []): string {
    const template = `
You are designing a REST API endpoint for ${spec.name} using Express and TypeScript.

Endpoint Specification:
- Name: ${spec.name}
- Description: ${spec.description || ''}
- Model: ${spec.model}
- Operations: ${spec.operations.join(', ')}
${spec.authentication ? '- Authentication: Required' : '- Authentication: Not required'}
${spec.validation ? '- Validation: Required' : '- Validation: Not required'}

Create a complete TypeScript file that implements this API endpoint.
The file should include:
1. Express router setup with proper typing
2. Route handlers for each operation (${spec.operations.join(', ')})
3. Proper error handling with try/catch blocks and appropriate status codes
4. TypeScript interfaces for request and response objects
5. Input validation using a validation library or middleware
6. Comprehensive JSDoc comments for all functions and interfaces
7. Middleware for common operations (authentication, logging, etc.)

Use best practices for RESTful APIs, including:
- Consistent route naming following REST conventions
- Proper HTTP status codes for different scenarios (200, 201, 400, 404, 500, etc.)
- Validation of inputs with descriptive error messages
- Structured error responses with consistent format
- Pagination for list operations
- Filtering and sorting capabilities where appropriate
- Rate limiting considerations
- Security headers and CORS configuration
- Clear comments and documentation for API consumers

IMPORTANT GUIDELINES:
- Follow the Single Responsibility Principle
- Implement proper error handling for all database operations and external calls
- Use async/await with try/catch for asynchronous operations
- Validate all inputs before processing
- Return consistent response formats
- Include proper logging for debugging and monitoring
- Consider performance implications of database queries
- Implement proper authentication and authorization checks
- Use middleware for cross-cutting concerns
- Follow the project's coding style and conventions

Return ONLY the TypeScript code for the API endpoint file.
`;

    // Add examples if provided
    if (examples.length > 0) {
      let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
      
      examples.forEach((example, index) => {
        examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`typescript\n${example.pageContent}\n\`\`\`\n\n`;
      });
      
      examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

IMPORTANT: Analyze the examples carefully to understand:
1. The project's coding style and conventions
2. How components are structured
3. How props are typed and validated
4. How state is managed
5. How events are handled
6. How styling is implemented
7. How accessibility is addressed
8. How error handling is implemented

Now, please generate the API endpoint according to the specification above.
Return ONLY the TypeScript code for the API endpoint file.
`;
      
      return template + examplesText;
    }
    
    return template;
  }
  
  /**
   * Create a prompt for generating a UI component
   */
  private createUIComponentPrompt(spec: any, examples: Document[] = []): string {
    const template = `
You are designing a UI component named ${spec.name} using ${spec.framework} and TypeScript.

Component Specification:
- Name: ${spec.name}
- Description: ${spec.description || ''}
- Props:
${spec.props.map((prop: { name: string; type: string; required?: boolean }) =>
  `  - ${prop.name}: ${prop.type}${prop.required ? ' (required)' : ''}`
).join('\n')}
${spec.styling ? `- Styling: ${spec.styling}` : ''}
${spec.state ? `- State Management: ${JSON.stringify(spec.state)}` : ''}
${spec.events ? `- Events: ${JSON.stringify(spec.events)}` : ''}

Create a complete TypeScript file that implements this UI component.
The file should include:
1. TypeScript interfaces for the component props and any other types with JSDoc comments
2. The React functional component with proper typing and error handling
3. JSX markup for the component UI with accessibility attributes
4. ${spec.styling ? `Styling using ${spec.styling} with responsive design` : 'Basic styling with responsive design'}
5. Comprehensive comments explaining the component's purpose, usage, and props
6. Unit test examples or testing notes in comments
7. Performance optimization considerations (memoization, etc.)

Use best practices for ${spec.framework}, including:
- Proper TypeScript typing (avoid 'any' type)
- Functional components with hooks for state and effects
- Proper prop validation with default values where appropriate
- Comprehensive error handling and edge cases
- Accessibility (ARIA attributes, keyboard navigation, etc.)
- Responsive design principles
- Component composition and reusability
- Performance optimization techniques
- Proper event handling

IMPORTANT GUIDELINES:
- Follow the Single Responsibility Principle
- Use proper TypeScript typing (avoid 'any' type)
- Implement proper error handling and fallbacks
- Ensure the component is accessible (WCAG compliance)
- Make the component responsive for different screen sizes
- Consider performance implications of rendering and re-rendering
- Follow the project's coding style and conventions
- Use proper naming conventions for variables, functions, and components
- Include proper documentation for the component
- Consider internationalization (i18n) if applicable

Return ONLY the TypeScript/TSX code for the component file.
`;

    // Add examples if provided
    if (examples.length > 0) {
      let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
      
      examples.forEach((example, index) => {
        examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`tsx\n${example.pageContent}\n\`\`\`\n\n`;
      });
      
      examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

IMPORTANT: Analyze the examples carefully to understand:
1. The project's coding style and conventions
2. How components are structured
3. How props are typed and validated
4. How state is managed
5. How events are handled
6. How styling is implemented
7. How accessibility is addressed
8. How error handling is implemented

Now, please generate the UI component according to the specification above.
Return ONLY the TypeScript/TSX code for the component file.
`;
      
      return template + examplesText;
    }
    
    return template;
  }
  
  /**
   * Extract code from an LLM response
   * @param response The LLM response text
   * @param language The language of the code to extract
   * @returns The extracted code
   */
  private extractCodeFromResponse(response: string, language: string): string {
    try {
      // Try to extract code from markdown code blocks with the specified language
      const languageCodeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\n([\\s\\S]*?)\\n\`\`\``, 'i');
      const languageMatch = response.match(languageCodeBlockRegex);
      
      if (languageMatch && languageMatch[1]) {
        return languageMatch[1].trim();
      }
      
      // If no language-specific code block found, try any code block
      const anyCodeBlockRegex = /```\n([\s\S]*?)\n```/;
      const anyMatch = response.match(anyCodeBlockRegex);
      
      if (anyMatch && anyMatch[1]) {
        return anyMatch[1].trim();
      }
      
      // If no code block found, try to clean up the response
      // Remove any markdown or explanatory text
      const lines = response.split('\n');
      
      // Filter out common non-code lines
      const codeLines = lines.filter(line => 
        !line.startsWith('#') && 
        !line.startsWith('>') && 
        !line.startsWith('*') &&
        !line.startsWith('-') &&
        !line.match(/^[0-9]+\./) && // Numbered lists
        !line.match(/^[A-Za-z]+:/) && // Key-value pairs
        line.trim() !== '' // Empty lines
      );
      
      // If we have at least some lines left, return them
      if (codeLines.length > 0) {
        return codeLines.join('\n').trim();
      }
      
      // Last resort: just return the whole response with minimal cleaning
      return response
        .replace(/^# .*$/gm, '') // Remove markdown headers
        .replace(/^> .*$/gm, '') // Remove blockquotes
        .replace(/\n\n+/g, '\n\n') // Normalize multiple newlines
        .trim();
    } catch (error) {
      console.error('Error extracting code from response:', error);
      // Return the original response as a fallback
      return response.trim();
    }
  }

  /**
   * Convert a DSL task to a TaskDefinition
   */
  private convertDSLTaskToDefinition(task: any): TaskDefinition {
    // Extract the task definition from the DSL task
    const id = task.id;
    const description = task.description || '';
    const implementation = task.implementation;
    
    // Extract retry policy if available
    const retry = task.retryPolicy ? {
      maxAttempts: task.retryPolicy.maxAttempts,
      backoff: typeof task.retryPolicy.delay === 'function' ? 'exponential' as const : 'fixed' as const,
      delayMs: typeof task.retryPolicy.delay === 'number' ? task.retryPolicy.delay : 1000
    } : undefined;
    
    // Create the TaskDefinition
    return {
      id,
      description,
      implementation,
      inputSchema: task.inputSchema,
      outputSchema: task.outputSchema,
      retry,
      metadata: task.metadata || {}
    };
  }
}

/**
 * Create a RAG-enhanced agent extension
 */
export function createRAGAgent(config: Partial<RAGAgentConfig> = {}): RAGAgentExtension {
  const mergedConfig: RAGAgentConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  return new RAGAgentExtension(mergedConfig);
} 