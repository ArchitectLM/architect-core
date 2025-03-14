# Examples

This directory contains various examples demonstrating the capabilities of the framework.

## DSL Examples

The `dsl` directory contains examples of Domain-Specific Language (DSL) files that can be executed in the DSL sandbox environment.

- `process.ts` - A simple process definition with states and transitions
- `minimal-example.ts` - A minimal example with a process, task, and system
- `simple-payment-example.ts` - A simple payment process example
- `esm-example.ts` - An example using ESM modules
- `system.ts` - A system definition example
- `task.ts` - A task definition example

To run the DSL sandbox test, use:

```bash
npm run sandbox-dsl
```

## Other Examples

- `dsl-sandbox-test.ts` - Demonstrates how to use the DSL sandbox to execute DSL files
- `enhanced-editor-test.ts` - Demonstrates the enhanced editor capabilities
- `simple-editor-test.ts` - Demonstrates the simple editor capabilities
- `rag-agent-example.ts` - Demonstrates the RAG (Retrieval-Augmented Generation) agent
- `project-structure-generation-example.ts` - Demonstrates project structure generation
- `reactive-runtime-example.ts` - Demonstrates the reactive runtime
- `plugin-runtime-example.ts` - Demonstrates the plugin runtime
- `plugin-example.ts` - Demonstrates plugin creation and usage
- `service-integration-example.ts` - Demonstrates service integration
- `reactive-system-runtime-example.ts` - Demonstrates the reactive system runtime
- `reactive-system-dsl-example.ts` - Demonstrates the reactive system DSL
- `test-implementation-generation.ts` - Demonstrates test implementation generation
- `implementation-generation-example.ts` - Demonstrates implementation generation
- `generate-todo-app.ts` - Demonstrates generating a todo app
- `documentation-generation-example.ts` - Demonstrates documentation generation
- `integration-test-generation-example.ts` - Demonstrates integration test generation
- `ui-component-generation-example.ts` - Demonstrates UI component generation
- `api-endpoint-generation-example.ts` - Demonstrates API endpoint generation
- `database-model-generation-example.ts` - Demonstrates database model generation
- `openrouter-rag-test.ts` - Demonstrates OpenRouter RAG testing
- `agent-example.ts` - Demonstrates agent creation and usage
- `fluent-api-example.ts` - Demonstrates the fluent API
- `order-processing.ts` - Demonstrates order processing

## Running Examples

Most examples can be run using the following command:

```bash
npx tsx examples/<example-file>.ts
```

For specific examples, there might be dedicated npm scripts. Check the `package.json` file for available scripts. 