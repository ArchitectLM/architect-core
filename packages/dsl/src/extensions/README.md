# ChromaDB Vector Database Adapter

This extension provides a ChromaDB implementation of the VectorDBAdapter interface for storing and retrieving components in a vector database.

## Features

- Store and retrieve components and implementations
- Manage relationships between components
- Semantic search for components
- Text chunking for better vector embeddings
- Clear database functionality

## Installation

First, install the required dependencies:

```bash
npm install chromadb
```

## Usage

### Basic Setup

```typescript
import { ChromaVectorDBAdapter } from './extensions/chroma-vector-db-adapter.js';

// Create a new adapter instance
const adapter = new ChromaVectorDBAdapter({
  url: 'http://localhost:8000',  // URL to your ChromaDB instance
  collectionName: 'components',  // Name of the collection to use
  chunkSize: 1000,               // Optional: Size of text chunks for embeddings
  chunkOverlap: 200              // Optional: Overlap between chunks
});

// Store a component
const componentId = await adapter.storeComponent({
  type: ComponentType.SCHEMA,
  name: 'User',
  description: 'User schema',
  definition: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' }
    }
  }
});

// Store an implementation
const implementationId = await adapter.storeImplementation({
  componentName: 'CreateUser',
  implementation: (input) => ({ ...input, id: '123' }),
  metadata: {
    complexity: 'low',
    estimatedLatency: 'low'
  }
});

// Store a relationship
await adapter.storeRelationship(
  'component-User',
  'component-CreateUser',
  'isUsedBy',
  'User is used by CreateUser'
);

// Search for components
const results = await adapter.searchComponents('user', { type: ComponentType.SCHEMA });

// Get related components
const relatedComponents = await adapter.getRelatedComponents('component-User', 'isUsedBy');

// Clear the database
await adapter.clear();
```

### Text Chunking

The adapter provides a utility method for chunking text into smaller pieces for better vector embeddings:

```typescript
const text = 'This is a long text that needs to be chunked into smaller pieces for better embeddings';
const chunks = adapter.chunkText(text, 50, 10);
```

## Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| url | string | URL to your ChromaDB instance | Required |
| collectionName | string | Name of the collection to use | Required |
| chunkSize | number | Size of text chunks for embeddings | 1000 |
| chunkOverlap | number | Overlap between chunks | 200 |

## Integration with Component Registry

You can register the ChromaDB adapter with the component registry:

```typescript
import { ComponentRegistry } from '../component-registry.js';
import { ChromaVectorDBAdapter } from './extensions/chroma-vector-db-adapter.js';

const registry = new ComponentRegistry();
const adapter = new ChromaVectorDBAdapter({
  url: 'http://localhost:8000',
  collectionName: 'components'
});

registry.setVectorDBAdapter(adapter);
```

## Running Tests

```bash
npm test -- tests/extensions/chroma-vector-db-adapter.test.ts
``` 