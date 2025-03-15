# ArchitectLM Monorepo

An architecture for building LLM-powered applications.

## Project Structure

The project is organized as a monorepo with the following packages:

- `packages/core`: Core functionality for the ArchitectLM framework
- `packages/dsl`: Domain-specific language for defining systems
- `packages/cli`: Command-line interface for ArchitectLM
- `packages/extensions`: Extensions for the ArchitectLM framework
- `packages/architectlm`: Main package for the ArchitectLM framework
- `packages/examples`: Example applications built with ArchitectLM

## Development

### Prerequisites

- Node.js (v18 or later)
- pnpm (v8 or later)

### Setup

```bash
# Install dependencies
pnpm install
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Type Checking

```bash
# Type check all packages
pnpm typecheck

# Type check tests
pnpm typecheck:tests
```

### Development Workflow

```bash
# Start development mode for a specific package
pnpm dev:core
pnpm dev:dsl
pnpm dev:cli
pnpm dev:extensions

# Run examples
pnpm example
```

### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check
```

## Package Structure

Each package follows a similar structure:

```
packages/[package-name]/
├── __tests__/        # Test files
├── src/              # Source code
├── package.json      # Package configuration
├── tsconfig.json     # TypeScript configuration
├── tsconfig.test.json # TypeScript configuration for tests
└── vitest.config.ts  # Vitest configuration
```

## Running Applications

To run an application directly:

```bash
# Navigate to a package
cd packages/[package-name]

# Start the application
pnpm start

# Or run in development mode with auto-reloading
pnpm dev
```

## Why ArchitectLM is Revolutionary

ArchitectLM represents a paradigm shift in software development:

### For Business Leaders

- **Reduced Time-to-Market**: Development speed increases by 5-10x through AI-assisted component generation
- **Improved Reliability**: Business-critical systems with 99.99% uptime through deterministic execution
- **Cost Efficiency**: Significantly reduced development and maintenance costs through automated architecture
- **Future-Proof Investment**: Systems that evolve naturally with changing business needs

### For Technical Leaders

- **End of Technical Debt**: Clean, consistent architecture that doesn't degrade over time
- **Team Productivity**: Engineers focus on business value instead of plumbing code
- **Operational Excellence**: Built-in observability and reliability patterns reduce operational overhead
- **Talent Leverage**: 10x developer productivity through AI assistance

### For Developers

- **Joy of Creation**: Focus on what matters – solving real problems, not wrestling with architecture
- **Continuous Learning**: AI-assisted development teaches best practices through generated examples
- **Reduced Cognitive Load**: System behavior is predictable and self-documenting
- **Work at Higher Level**: Operate at the level of business logic rather than implementation details

## Monorepo Structure

This project is organized as a monorepo using pnpm workspaces. The monorepo is organized into the following packages:

- [@architectlm/core](./packages/core): Core components of the framework
- [@architectlm/extensions](./packages/extensions): Extensions for the framework
- [@architectlm/dsl](./packages/dsl): Domain-Specific Language for the framework
- [@architectlm/cli](./packages/cli): Command-line tools for the framework
- [@architectlm/examples](./packages/examples): Examples for the framework
- [architectlm](./packages/architectlm): Main package that re-exports all functionality

## Quick Start

```typescript
import { Process, Task, System, createRuntime } from 'architectlm';
import { z } from 'zod';

// Define a process
const orderProcess = Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING',
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE',
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .build();

// Define a task
const processOrderTask = Task.create('process-order')
  .withDescription('Processes an order')
  .withImplementation(async (input, context) => {
    // Process the order
    context.emitEvent('COMPLETE', { orderId: input.orderId });
    return { processed: true };
  })
  .build();

// Define a system
const ecommerceSystem = System.create('ecommerce')
  .withDescription('E-commerce system')
  .addProcess(orderProcess)
  .addTask(processOrderTask)
  .build();

// Create a runtime and use it
const runtime = createRuntime(ecommerceSystem);
const instance = runtime.createProcess('order-process', { orderId: '12345' });
await runtime.executeTask('process-order', { orderId: '12345' });
```

## License

MIT

## Recent Updates

### Project Restructuring (June 2024)

The project has been restructured to improve maintainability and type safety:

1. Deprecated the original `src` directory and moved it to `deprecated/src`
2. Organized code into packages:

   - `packages/core`: Core functionality
   - `packages/dsl`: Domain-specific language
   - `packages/extensions`: Extensions and integrations
   - `packages/cli`: Command-line interface
   - `packages/architectlm`: Main package that exports all functionality

3. Fixed TypeScript configurations:

   - Added proper type definitions
   - Excluded test files from compilation
   - Resolved import path issues

4. Improved package structure:
   - Clear separation of concerns
   - Better module organization
   - Explicit exports

To run type checking:

```bash
pnpm typecheck
```
