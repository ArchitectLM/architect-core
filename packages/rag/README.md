# @architectlm/rag

Retrieval Augmented Generation (RAG) integration for the ArchitectLM reactive system.

## Overview

The `@architectlm/rag` package provides a comprehensive RAG integration for the ArchitectLM reactive system. It enables AI agents to understand and modify the system by:

- Indexing all components in a vector database
- Retrieving relevant components based on user requests
- Generating edit contexts based on the request
- Validating generated code before applying it

## Features

- **Vector Database Integration**: ChromaDB connector for efficient storage and retrieval
- **Document Chunking**: Strategies for breaking down code into meaningful chunks
- **Multi-modal Search**: Search across different types of components
- **Embedding Generation**: Generate embeddings for code and documentation
- **Context-aware Code Modification**: Understand the global system when making changes
- **Component Discovery**: Find relevant components through vector search
- **LLM Integration**: Generate code with appropriate context

## Installation

```bash
npm install @architectlm/rag
# or
yarn add @architectlm/rag
# or
pnpm add @architectlm/rag
```

## Usage

### Setting up the Vector Database

```typescript
import { VectorDBConnector } from "@architectlm/rag";

// Create a ChromaDB connector
const vectorDB = new VectorDBConnector({
  collectionName: "architectlm-components",
  persistDirectory: "./vector-db",
});

// Initialize the database
await vectorDB.initialize();
```

### Indexing Components

```typescript
import { ComponentIndexer } from "@architectlm/rag";

// Create a component indexer
const indexer = new ComponentIndexer(vectorDB);

// Index a component
await indexer.indexComponent({
  type: "function",
  name: "processPayment",
  content: "...",
  metadata: {
    path: "src/functions/payment.ts",
    description: "Processes a payment transaction",
  },
});
```

### Searching for Components

```typescript
import { ComponentSearch } from "@architectlm/rag";

// Create a component search
const search = new ComponentSearch(vectorDB);

// Search for components
const results = await search.searchComponents("payment processing", {
  limit: 5,
  types: ["function", "command"],
});
```

### Generating Edit Context

```typescript
import { EditContextGenerator } from "@architectlm/rag";

// Create an edit context generator
const contextGenerator = new EditContextGenerator(search);

// Generate edit context
const editContext = await contextGenerator.generateContext(
  "Add validation to payment processing",
);
```

### Validating Generated Code

```typescript
import { CodeValidator } from "@architectlm/rag";

// Create a code validator
const validator = new CodeValidator();

// Validate generated code
const validationResult = await validator.validateCode(
  generatedCode,
  editContext,
);
```

## Integration with Event System

The RAG system integrates with the ArchitectLM event system to provide real-time updates and notifications:

```typescript
import { ReactiveEventBus } from "@architectlm/core";
import { RAGEventHandler } from "@architectlm/rag";

// Create an event bus
const eventBus = new ReactiveEventBus();

// Create a RAG event handler
const ragEventHandler = new RAGEventHandler(eventBus, vectorDB);

// Initialize the event handler
ragEventHandler.initialize();
```

## License

MIT
