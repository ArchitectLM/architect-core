# DSL2 Tests Refactoring Plan

## Overview

This document outlines the refactoring plan for DSL2 test suite to improve organization, focus, and maintenance of tests.

## Goals

1. Separate unit, integration, and e2e tests clearly
2. Organize tests by component types and concerns
3. Make tests more focused on specific functionality
4. Improve test coverage
5. Make it easier to find and update tests
6. Ensure proper integration testing between extensions and core runtime

## Directory Structure

```
packages/dsl2/tests/
├── unit/
│   ├── components/           # Tests for component types
│   │   ├── schema-component.test.ts
│   │   ├── command-component.test.ts
│   │   ├── event-component.test.ts
│   │   ├── ... (other component types)
│   ├── actor/                # Actor-related tests
│   │   ├── actor-definition.test.ts
│   │   ├── actor-implementation.test.ts
│   │   ├── actor-messaging.test.ts
│   │   ├── actor-lifecycle.test.ts
│   ├── system/               # System-related tests
│   │   ├── system-definition.test.ts
│   ├── extensions/           # Extension unit tests
│   │   ├── process-core.test.ts
│   │   ├── schema-core.test.ts
│   │   ├── ... (other extension core tests)
├── integration/              # Integration tests
│   ├── extensions/           # Extension integration tests
│   │   ├── extension-interactions.test.ts
│   ├── runtime/              # Core runtime integration tests
│   │   ├── dsl-core2-integration.test.ts
├── e2e/                      # End-to-end tests
```

## Unit Tests

### Component Type Tests

Each component type (schema, command, event, process, etc.) has its own test file that focuses on:
- Component definition
- Specific properties and behaviors of that component type
- Validation of component-specific properties

### Actor Tests

Actor tests are split into logical groups:
- **actor-definition.test.ts**: Tests for defining actors with different properties
- **actor-implementation.test.ts**: Tests for implementing actors with message handlers
- **actor-messaging.test.ts**: Tests for actor messaging patterns
- **actor-lifecycle.test.ts**: Tests for actor lifecycle (create, start, stop, restart)

### System Tests

System tests focus on:
- System definition with various components
- System composition and integration
- System validation

### Extension Unit Tests

Each extension has a focused unit test that tests only its core functionality:
- Registration with DSL
- Extension-specific component definition
- Extension-specific validation

## Integration Tests

### Extension Integration Tests

Tests how extensions integrate with each other:
- Multiple extensions working together
- Interactions between extension-enhanced components
- Cross-extension features and behavior

### Runtime Integration Tests

Tests DSL to Core2 runtime integration:
- Conversion of DSL components to runtime configuration
- Runtime creation from DSL system definitions
- Process and task execution in runtime
- Component lifecycle in runtime

## E2E Tests

Will be implemented later:
- Complete system tests with real-world scenarios
- Full business process flows

## Implementation Notes

1. All tests use mock implementations where needed to focus on the specific functionality being tested
2. Each test focuses on a specific concern to make tests more maintainable
3. Test data is kept minimal but sufficient for testing the feature
4. All external dependencies are properly mocked to ensure tests are isolated

## Linter Errors

There are currently linter errors related to TypeScript typing in the tests. These errors should be addressed by:

1. Creating proper type definitions for all DSL components
2. Using type assertions where appropriate
3. Fixing the DSL implementation to properly expose component properties

## Next Steps

1. Create more focused extension unit tests
2. Expand integration test coverage
3. Add runtime adapter integration tests
4. Implement E2E tests for complete systems 