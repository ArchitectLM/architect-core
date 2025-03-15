/**
 * Database Model Generation Example
 * 
 * This example demonstrates how to use the enhanced RAG agent to generate
 * a database model for a Todo application.
 */

import { System, createRuntime } from '../src';
import * as fs from 'fs';
import * as path from 'path';

// Mock RAGAgentConfig interface
interface RAGAgentConfig {
  provider: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  codebasePath?: string;
  useInMemoryVectorStore?: boolean;
}

// Mock RAGAgentExtension class
class MockRAGAgentExtension {
  private config: RAGAgentConfig;
  private runtime: any;

  constructor(config: Partial<RAGAgentConfig> = {}) {
    // Default configuration
    const defaultConfig: RAGAgentConfig = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      codebasePath: './src',
      useInMemoryVectorStore: false,
      apiKey: process.env.OPENAI_API_KEY || '',
    };
    
    this.config = { ...defaultConfig, ...config };
  }

  async initialize(runtime: any): Promise<void> {
    this.runtime = runtime;
    console.log(`Mock RAG Agent initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
  }

  // This would be one of the new methods we're proposing to add
  async generateDatabaseSchema(schemaSpec: any): Promise<any> {
    console.log('Preparing prompt for the LLM...');
    const prompt = `
      Generate a database schema for a ${schemaSpec.name} with the following fields:
      ${schemaSpec.fields.map((field: any) => 
        `- ${field.name}: ${field.type}${field.required ? ' (required)' : ''}${field.default ? ` (default: ${field.default})` : ''}`
      ).join('\n')}
      
      The schema should be implemented using Mongoose and TypeScript.
      Include proper validation, indexes, and type definitions.
    `;
    
    console.log('Calling LLM to generate schema code...');
    // In a real implementation, this would call the LLM
    // For this example, we'll just return a hardcoded response
    
    return {
      name: schemaSpec.name,
      description: schemaSpec.description,
      fields: schemaSpec.fields.map((field: any) => ({
        name: field.name,
        type: field.type,
        required: field.required || false,
        default: field.default
      })),
      code: `
import mongoose, { Document, Schema } from 'mongoose';

// Define the Todo interface
export interface ITodo extends Document {
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define the Todo schema
const TodoSchema = new Schema<ITodo>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  completed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create and export the Todo model
const Todo = mongoose.model<ITodo>('Todo', TodoSchema);
export default Todo;
      `.trim()
    };
  }

  // This would be one of the new methods we're proposing to add
  async generateDatabaseModelFile(modelDefinition: any, outputPath: string): Promise<string> {
    console.log('Ensuring directory exists...');
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    
    console.log('Writing code to file...');
    fs.writeFileSync(outputPath, modelDefinition.code);
    
    return outputPath;
  }
}

// Mock createRAGAgent function
function createMockRAGAgent(config: Partial<RAGAgentConfig> = {}): MockRAGAgentExtension {
  return new MockRAGAgentExtension(config);
}

// This is a conceptual example of how the database model generation would work
async function main() {
  console.log('Starting Database Model Generation Example...');
  
  // Initialize the RAG agent with configuration
  const config: Partial<RAGAgentConfig> = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || '',
    temperature: 0.7,
    codebasePath: './src',
    useInMemoryVectorStore: true
  };
  
  // Create the mock RAG agent
  const ragAgent = createMockRAGAgent(config);
  
  // Create a simple system
  const systemConfig = System.create('todo-system')
    .withName('Todo System')
    .withDescription('A system for managing todo items')
    .build();
  
  // Initialize the runtime and the agent
  const runtime = createRuntime(systemConfig);
  await ragAgent.initialize(runtime);
  
  // Create output directory
  const outputDir = path.join(__dirname, '../output/todo-app');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('\n--- Generating Database Model ---');
  
  // Define the database schema specification
  const todoSchemaSpec = {
    name: 'Todo',
    description: 'A todo item',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'completed', type: 'boolean', default: false },
      { name: 'createdAt', type: 'date', default: 'Date.now' },
      { name: 'updatedAt', type: 'date', default: 'Date.now' }
    ]
  };
  
  try {
    // Generate the database schema
    const modelDefinition = await ragAgent.generateDatabaseSchema(todoSchemaSpec);
    console.log('\nGenerated model definition:');
    console.log(`Name: ${modelDefinition.name}`);
    console.log(`Description: ${modelDefinition.description}`);
    console.log('Fields:');
    modelDefinition.fields.forEach((field: any) => {
      console.log(`  - ${field.name}: ${field.type}${field.required ? ' (required)' : ''}${field.default ? ` (default: ${field.default})` : ''}`);
    });
    
    // Generate the database model file
    const modelPath = await ragAgent.generateDatabaseModelFile(
      modelDefinition, 
      path.join(outputDir, 'backend/models/Todo.ts')
    );
    console.log(`\nDatabase model generated at: ${modelPath}`);
    
    // Display the generated code
    console.log('\nGenerated code:');
    console.log('```typescript');
    console.log(modelDefinition.code);
    console.log('```');
  } catch (error) {
    console.error('Error generating database model:', error);
  }
  
  console.log('\n--- Example Complete ---');
  console.log('Note: This is a simulation. The actual implementation would be part of the RAGAgentExtension class.');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in database model generation example:', error);
    process.exit(1);
  });
}

export default main; 