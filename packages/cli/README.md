# @architectlm/cli

Command-line tools for the ArchitectLM framework.

## Features

- DSL editing with AI assistance
- Interactive editing with visual diffs
- Undo functionality for edits
- Schema validation for DSL files
- Context-aware editing with RAG

## Usage

### Command-Line Interface

```bash
# Edit a DSL file
architectlm edit-dsl "Add a completed state and a transition from processing to completed on COMPLETE event"

# Edit a DSL file with AI assistance
architectlm edit-dsl-ai "Add a completed state and a transition from processing to completed on COMPLETE event"

# Run a DSL sandbox
architectlm sandbox-dsl
```

### Programmatic Usage

```typescript
import { editDSL } from '@architectlm/cli';

// Edit a DSL file
const result = await editDSL({
  dslDirectory: './src/dsl',
  userRequest: 'Add a completed state and a transition from processing to completed on COMPLETE event',
  interactive: true // Enable interactive mode
});

console.log('Edit result:', result);
``` 