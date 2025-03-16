# ArchitectLM Examples

This directory contains example implementations that demonstrate different aspects of the ArchitectLM framework.

## Schema Examples

- **todo-system.json**: A simple todo management system schema without extensions
- **e-commerce-system.json**: A more complex e-commerce system schema that uses the e-commerce extension

## Reactive System Examples

- **todo-reactive-system.ts**: Demonstrates how to use the reactive system architecture to build a Todo application
- **dsl-todo-system.ts**: Shows how to use the DSL integration module with the reactive system

## Running the Examples

### Schema Examples

You can validate the schema examples using the CLI:

```bash
# Validate the todo system schema
node ./bin/architect-cli.js validate -f examples/todo-system.json

# Validate the e-commerce system schema
node ./bin/architect-cli.js validate -f examples/e-commerce-system.json
```

### Reactive System Examples

You can run the reactive system examples using the following commands:

```bash
# Run the todo reactive system example
npm run dev -- examples/todo-reactive-system.ts

# Run the DSL todo system example
npm run dev -- examples/dsl-todo-system.ts
```

## Todo Reactive System Example

The `todo-reactive-system.ts` example demonstrates how to use the reactive system architecture to build a simple Todo application. It shows:

1. How to set up the reactive system runtime
2. How to create and use repositories for data storage
3. How to register processes and their handlers
4. How to implement and register tasks
5. How to execute flows
6. How the event-driven architecture responds to changes in the system

The example creates several Todo items with different priorities, marks one as important using a flow, filters important todos, and demonstrates state transitions when todos are completed or archived.

Key components demonstrated:

- **ReactiveSystemRuntime**: The main runtime that integrates all components
- **InMemoryTodoRepository**: A repository for storing and retrieving Todo items
- **TodoProcessHandlers**: Handlers for the Todo process state transitions
- **MarkImportantTaskImpl**: A task implementation for marking todos as important
- **FilterImportantTodosTaskImpl**: A task implementation for filtering important todos
- **TodoEventHandlers**: Handlers for Todo-related events

This example provides a practical demonstration of how the reactive system architecture can be used to build a real-world application with complex behavior and state management.