/**
 * Documentation Generation Example
 * 
 * This example demonstrates how to use the enhanced RAG agent to generate
 * documentation for a Todo application.
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
  async generateDocumentation(docSpec: any): Promise<any> {
    console.log('Preparing prompt for the LLM...');
    const prompt = `
      Generate documentation for ${docSpec.name} with the following specifications:
      
      Components to document:
      ${docSpec.components.map((component: string) => `- ${component}`).join('\n')}
      
      Documentation sections:
      ${docSpec.sections.map((section: string) => `- ${section}`).join('\n')}
      
      Include proper formatting, examples, and explanations.
    `;
    
    console.log('Calling LLM to generate documentation...');
    // In a real implementation, this would call the LLM
    // For this example, we'll just return a hardcoded response
    
    return {
      name: docSpec.name,
      description: docSpec.description,
      components: docSpec.components,
      sections: docSpec.sections,
      content: `# ${docSpec.name} Documentation

## Overview

${docSpec.description}

This documentation provides a comprehensive guide to the Todo application, including setup instructions, API reference, component usage, and examples.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Component Reference](#component-reference)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB (for the backend)

### Setup

1. Clone the repository:

\`\`\`bash
git clone https://github.com/yourusername/todo-app.git
cd todo-app
\`\`\`

2. Install dependencies:

\`\`\`bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
\`\`\`

3. Set up environment variables:

Create a \`.env\` file in the \`backend\` directory with the following content:

\`\`\`
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/todo-app
\`\`\`

## Getting Started

### Running the Application

1. Start the development servers:

\`\`\`bash
# From the root directory
npm run dev
\`\`\`

This will start both the frontend and backend servers concurrently.

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Basic Usage

1. Create a new todo by filling out the form and clicking "Add Todo"
2. Toggle a todo's completion status by clicking the checkbox
3. Delete a todo by clicking the trash icon

## API Reference

### Todo Endpoints

#### GET /api/todos

Returns a list of all todos.

**Response**

\`\`\`json
[
  {
    "_id": "60d21b4667d0d8992e610c85",
    "title": "Complete project",
    "description": "Finish the Todo app project",
    "completed": false,
    "createdAt": "2023-06-22T10:30:00.000Z",
    "updatedAt": "2023-06-22T10:30:00.000Z"
  },
  {
    "_id": "60d21b4667d0d8992e610c86",
    "title": "Learn TypeScript",
    "description": "Study advanced TypeScript concepts",
    "completed": true,
    "createdAt": "2023-06-21T15:45:00.000Z",
    "updatedAt": "2023-06-22T09:15:00.000Z"
  }
]
\`\`\`

#### GET /api/todos/:id

Returns a single todo by ID.

**Parameters**

- \`id\`: The ID of the todo to retrieve

**Response**

\`\`\`json
{
  "_id": "60d21b4667d0d8992e610c85",
  "title": "Complete project",
  "description": "Finish the Todo app project",
  "completed": false,
  "createdAt": "2023-06-22T10:30:00.000Z",
  "updatedAt": "2023-06-22T10:30:00.000Z"
}
\`\`\`

#### POST /api/todos

Creates a new todo.

**Request Body**

\`\`\`json
{
  "title": "New Todo",
  "description": "Description of the new todo",
  "completed": false
}
\`\`\`

**Response**

\`\`\`json
{
  "_id": "60d21b4667d0d8992e610c87",
  "title": "New Todo",
  "description": "Description of the new todo",
  "completed": false,
  "createdAt": "2023-06-23T08:00:00.000Z",
  "updatedAt": "2023-06-23T08:00:00.000Z"
}
\`\`\`

#### PUT /api/todos/:id

Updates an existing todo.

**Parameters**

- \`id\`: The ID of the todo to update

**Request Body**

\`\`\`json
{
  "title": "Updated Todo",
  "completed": true
}
\`\`\`

**Response**

\`\`\`json
{
  "_id": "60d21b4667d0d8992e610c85",
  "title": "Updated Todo",
  "description": "Finish the Todo app project",
  "completed": true,
  "createdAt": "2023-06-22T10:30:00.000Z",
  "updatedAt": "2023-06-23T09:45:00.000Z"
}
\`\`\`

#### DELETE /api/todos/:id

Deletes a todo.

**Parameters**

- \`id\`: The ID of the todo to delete

**Response**

\`\`\`json
{
  "message": "Todo removed"
}
\`\`\`

## Component Reference

### TodoList

A component that displays a list of todo items with toggle and delete functionality.

**Props**

- \`todos\`: Array of Todo objects (required)
- \`onToggle\`: Function to call when a todo's completion status is toggled (required)
- \`onDelete\`: Function to call when a todo is deleted (required)

**Example Usage**

\`\`\`tsx
import React, { useState, useEffect } from 'react';
import TodoList from './components/TodoList';
import axios from 'axios';

const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const fetchTodos = async () => {
      const response = await axios.get('/api/todos');
      setTodos(response.data);
    };
    
    fetchTodos();
  }, []);

  const handleToggle = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      await axios.put(\`/api/todos/\${id}\`, {
        completed: !todo.completed
      });
      
      setTodos(todos.map(t => 
        t.id === id ? { ...t, completed: !t.completed } : t
      ));
    }
  };

  const handleDelete = async (id: string) => {
    await axios.delete(\`/api/todos/\${id}\`);
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Todo List</h1>
      <TodoList 
        todos={todos} 
        onToggle={handleToggle} 
        onDelete={handleDelete} 
      />
    </div>
  );
};

export default App;
\`\`\`

## Database Schema

### Todo Model

The Todo model represents a single todo item in the database.

**Schema**

\`\`\`typescript
interface ITodo extends Document {
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
\`\`\`

## Testing

### Running Tests

To run the integration tests:

\`\`\`bash
# From the backend directory
npm test
\`\`\`

### Test Coverage

The tests cover all CRUD operations for the Todo API endpoints, including error handling and validation.

## Deployment

### Frontend Deployment

The frontend can be deployed to services like Vercel, Netlify, or GitHub Pages:

\`\`\`bash
# From the frontend directory
npm run build
\`\`\`

This will create a production build in the \`build\` directory.

### Backend Deployment

The backend can be deployed to services like Heroku, Railway, or Render:

1. Create a production build:

\`\`\`bash
# From the backend directory
npm run build
\`\`\`

2. Set up environment variables on your hosting platform:
   - \`NODE_ENV=production\`
   - \`MONGODB_URI=your_mongodb_connection_string\`
   - \`PORT=your_port\` (often set automatically by the hosting platform)

3. Deploy the application according to your hosting platform's instructions.

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running locally or your connection string is correct
   - Check network connectivity to your MongoDB instance

2. **API Endpoint 404 Errors**
   - Verify the API base URL is correctly configured in the frontend
   - Check that the backend server is running

3. **CORS Issues**
   - Ensure the backend has CORS configured correctly for your frontend domain

### Getting Help

If you encounter any issues not covered in this documentation, please:

1. Check the GitHub issues for similar problems
2. Create a new issue with detailed information about the problem
3. Include steps to reproduce, expected behavior, and actual behavior
`
    };
  }

  // This would be one of the new methods we're proposing to add
  async generateDocumentationFile(docDefinition: any, outputPath: string): Promise<string> {
    console.log('Ensuring directory exists...');
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    
    console.log('Writing documentation to file...');
    fs.writeFileSync(outputPath, docDefinition.content);
    
    return outputPath;
  }
}

// Mock createRAGAgent function
function createMockRAGAgent(config: Partial<RAGAgentConfig> = {}): MockRAGAgentExtension {
  return new MockRAGAgentExtension(config);
}

// This is a conceptual example of how the documentation generation would work
async function main() {
  console.log('Starting Documentation Generation Example...');
  
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
  
  console.log('\n--- Generating Documentation ---');
  
  // Define the documentation specification
  const todoDocSpec = {
    name: 'Todo App',
    description: 'A simple todo application with React frontend and Express backend',
    components: [
      'Todo Model',
      'Todo API Endpoints',
      'TodoList Component'
    ],
    sections: [
      'Overview',
      'Installation',
      'Getting Started',
      'API Reference',
      'Component Reference',
      'Database Schema',
      'Testing',
      'Deployment',
      'Troubleshooting'
    ]
  };
  
  try {
    // Generate the documentation
    const docDefinition = await ragAgent.generateDocumentation(todoDocSpec);
    console.log('\nGenerated documentation definition:');
    console.log(`Name: ${docDefinition.name}`);
    console.log(`Description: ${docDefinition.description}`);
    console.log('Components:');
    docDefinition.components.forEach((component: string) => {
      console.log(`  - ${component}`);
    });
    console.log('Sections:');
    docDefinition.sections.forEach((section: string) => {
      console.log(`  - ${section}`);
    });
    
    // Generate the documentation file
    const docPath = await ragAgent.generateDocumentationFile(
      docDefinition, 
      path.join(outputDir, 'docs/README.md')
    );
    console.log(`\nDocumentation generated at: ${docPath}`);
    
    // Display a preview of the generated documentation
    console.log('\nDocumentation preview:');
    const previewLines = docDefinition.content.split('\n').slice(0, 20);
    console.log(previewLines.join('\n'));
    console.log('...');
  } catch (error) {
    console.error('Error generating documentation:', error);
  }
  
  console.log('\n--- Example Complete ---');
  console.log('Note: This is a simulation. The actual implementation would be part of the RAGAgentExtension class.');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in documentation generation example:', error);
    process.exit(1);
  });
}

export default main; 