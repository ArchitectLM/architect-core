/**
 * Integration Test Generation Example
 * 
 * This example demonstrates how to use the enhanced RAG agent to generate
 * integration tests for a Todo application.
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
  async generateIntegrationTest(testSpec: any): Promise<any> {
    console.log('Preparing prompt for the LLM...');
    const prompt = `
      Generate integration tests for ${testSpec.name} with the following specifications:
      
      API Endpoints to test:
      ${testSpec.endpoints.map((endpoint: string) => `- ${endpoint}`).join('\n')}
      
      Test scenarios:
      ${testSpec.scenarios.map((scenario: string) => `- ${scenario}`).join('\n')}
      
      Use ${testSpec.framework} for testing.
      Include proper setup, teardown, and error handling.
    `;
    
    console.log('Calling LLM to generate integration test code...');
    // In a real implementation, this would call the LLM
    // For this example, we'll just return a hardcoded response
    
    return {
      name: testSpec.name,
      description: testSpec.description,
      endpoints: testSpec.endpoints,
      scenarios: testSpec.scenarios,
      code: `
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import Todo from '../src/models/Todo';

describe('${testSpec.name} API Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testTodoId: string;

  // Setup - Connect to in-memory MongoDB before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  // Clear database between tests
  beforeEach(async () => {
    await Todo.deleteMany({});
  });

  // Disconnect and close MongoDB after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Test creating a todo
  test('POST /api/todos - should create a new todo', async () => {
    const todoData = {
      title: 'Test Todo',
      description: 'This is a test todo',
      completed: false
    };

    const response = await request(app)
      .post('/api/todos')
      .send(todoData)
      .expect(201);

    expect(response.body).toHaveProperty('_id');
    expect(response.body.title).toBe(todoData.title);
    expect(response.body.description).toBe(todoData.description);
    expect(response.body.completed).toBe(todoData.completed);

    // Save ID for later tests
    testTodoId = response.body._id;
  });

  // Test getting all todos
  test('GET /api/todos - should return all todos', async () => {
    // Create test todos
    await Todo.create([
      { title: 'Todo 1', description: 'Description 1', completed: false },
      { title: 'Todo 2', description: 'Description 2', completed: true }
    ]);

    const response = await request(app)
      .get('/api/todos')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    expect(response.body[0]).toHaveProperty('title');
    expect(response.body[1]).toHaveProperty('completed');
  });

  // Test getting a single todo
  test('GET /api/todos/:id - should return a single todo', async () => {
    // Create a test todo
    const todo = await Todo.create({
      title: 'Get Test Todo',
      description: 'This is a test for getting a single todo',
      completed: false
    });

    const response = await request(app)
      .get(\`/api/todos/\${todo._id}\`)
      .expect(200);

    expect(response.body).toHaveProperty('_id');
    expect(response.body.title).toBe(todo.title);
    expect(response.body.description).toBe(todo.description);
  });

  // Test updating a todo
  test('PUT /api/todos/:id - should update a todo', async () => {
    // Create a test todo
    const todo = await Todo.create({
      title: 'Update Test Todo',
      description: 'This is a test for updating a todo',
      completed: false
    });

    const updateData = {
      title: 'Updated Todo',
      completed: true
    };

    const response = await request(app)
      .put(\`/api/todos/\${todo._id}\`)
      .send(updateData)
      .expect(200);

    expect(response.body.title).toBe(updateData.title);
    expect(response.body.completed).toBe(updateData.completed);
    expect(response.body.description).toBe(todo.description); // Should remain unchanged
  });

  // Test deleting a todo
  test('DELETE /api/todos/:id - should delete a todo', async () => {
    // Create a test todo
    const todo = await Todo.create({
      title: 'Delete Test Todo',
      description: 'This is a test for deleting a todo',
      completed: false
    });

    await request(app)
      .delete(\`/api/todos/\${todo._id}\`)
      .expect(200);

    // Verify todo was deleted
    const deletedTodo = await Todo.findById(todo._id);
    expect(deletedTodo).toBeNull();
  });

  // Test error handling - invalid ID
  test('GET /api/todos/:id - should return 404 for invalid ID', async () => {
    const invalidId = new mongoose.Types.ObjectId();
    
    await request(app)
      .get(\`/api/todos/\${invalidId}\`)
      .expect(404);
  });

  // Test validation - missing required field
  test('POST /api/todos - should return 400 for missing required field', async () => {
    const invalidTodo = {
      description: 'Missing title field'
      // title is missing
    };

    const response = await request(app)
      .post('/api/todos')
      .send(invalidTodo)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('validation');
  });
});
      `.trim()
    };
  }

  // This would be one of the new methods we're proposing to add
  async generateIntegrationTestFile(testDefinition: any, outputPath: string): Promise<string> {
    console.log('Ensuring directory exists...');
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    
    console.log('Writing code to file...');
    fs.writeFileSync(outputPath, testDefinition.code);
    
    return outputPath;
  }
}

// Mock createRAGAgent function
function createMockRAGAgent(config: Partial<RAGAgentConfig> = {}): MockRAGAgentExtension {
  return new MockRAGAgentExtension(config);
}

// This is a conceptual example of how the integration test generation would work
async function main() {
  console.log('Starting Integration Test Generation Example...');
  
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
  
  console.log('\n--- Generating Integration Tests ---');
  
  // Define the integration test specification
  const todoTestSpec = {
    name: 'Todo',
    description: 'Integration tests for Todo API endpoints',
    endpoints: [
      'GET /api/todos',
      'GET /api/todos/:id',
      'POST /api/todos',
      'PUT /api/todos/:id',
      'DELETE /api/todos/:id'
    ],
    scenarios: [
      'Create a new todo',
      'Get all todos',
      'Get a single todo',
      'Update a todo',
      'Delete a todo',
      'Handle invalid ID',
      'Validate required fields'
    ],
    framework: 'jest'
  };
  
  try {
    // Generate the integration test
    const testDefinition = await ragAgent.generateIntegrationTest(todoTestSpec);
    console.log('\nGenerated integration test definition:');
    console.log(`Name: ${testDefinition.name}`);
    console.log(`Description: ${testDefinition.description}`);
    console.log('Endpoints:');
    testDefinition.endpoints.forEach((endpoint: string) => {
      console.log(`  - ${endpoint}`);
    });
    console.log('Scenarios:');
    testDefinition.scenarios.forEach((scenario: string) => {
      console.log(`  - ${scenario}`);
    });
    
    // Generate the integration test file
    const testPath = await ragAgent.generateIntegrationTestFile(
      testDefinition, 
      path.join(outputDir, 'backend/tests/todo.test.ts')
    );
    console.log(`\nIntegration test generated at: ${testPath}`);
    
    // Display the generated code
    console.log('\nGenerated code:');
    console.log('```typescript');
    console.log(testDefinition.code);
    console.log('```');
  } catch (error) {
    console.error('Error generating integration test:', error);
  }
  
  console.log('\n--- Example Complete ---');
  console.log('Note: This is a simulation. The actual implementation would be part of the RAGAgentExtension class.');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in integration test generation example:', error);
    process.exit(1);
  });
}

export default main; 