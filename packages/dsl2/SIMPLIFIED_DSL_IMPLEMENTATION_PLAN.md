# Simplified DSL Implementation Plan

This document outlines the implementation plan for the simplified DSL approach that focuses on composition, attribute-based specialization, and a minimal set of core component types.

## 1. Core Components Refinement

### Phase 1: Core Model Enhancement
1. **Update Component Models**
   - Enhance `ComponentDefinition` with `attributes`, `behaviors`, and `policies` fields
   - Update `SystemDefinition` to use a more readable component reference format
   - Add `ComponentReference` interface for consistent referencing

2. **Simplify Component Types**
   - Focus on the minimal set: SCHEMA, EVENT, ACTOR, PROCESS, SYSTEM
   - Add TEST as a core component type for declarative testing
   - Ensure backward compatibility with existing component types

3. **Core DSL Class Enhancement**
   - Add dedicated `system()` method for creating system components
   - Enhance validation for attributes, behaviors, and policies
   - Add attribute processing capability

### Phase 2: Attribute-Based Specialization
1. **Define Standard Attributes**
   - `eventSourced` for event sourcing capability on actors
   - `cqrs` for CQRS pattern on systems
   - `messageBus` for message bus capability on processes

2. **Attribute Processor**
   - Create attribute processors that enhance components based on attributes
   - Implement runtime transformation of attributes to specialized behavior
   - Add validation for attribute configurations

3. **Behavior Composition**
   - Implement actor behavior composition
   - Create behavior merging logic for message handlers and state
   - Add validation for behavior composition

## 2. Extensions Refactoring

### Phase 1: Convert Specialized Components to Attributes
1. **Workflow Extension**
   - Convert to attribute-based specialization on PROCESS components
   - Maintain backward compatibility with existing workflow components
   - Update tests to use attribute-based approach

2. **Saga Extension**
   - Convert to attribute-based specialization on PROCESS components
   - Maintain backward compatibility with existing saga components
   - Update tests to use attribute-based approach

3. **Other Specialized Extensions**
   - Review all specialized extensions and convert to attribute-based where appropriate
   - Maintain backward compatibility with existing extensions
   - Update tests to use attribute-based approach

### Phase 2: Policy Enhancement
1. **Policy Framework**
   - Implement policy application at actor and system levels
   - Create standard policies for common patterns (retry, timeout, circuit breaker)
   - Add validation for policy configurations

2. **Policy Processors**
   - Create policy processors that enhance components based on policies
   - Implement runtime transformation of policies to enhanced behavior
   - Add policy composition and conflict resolution

## 3. Testing Framework

### Phase 1: Declarative Testing
1. **Test Component Definition**
   - Implement TEST component type
   - Create test scenario, step, and assertion models
   - Add validation for test definitions

2. **Test Runner**
   - Implement test scenario execution
   - Create test runner for executing test scenarios
   - Add test result reporting

### Phase 2: Advanced Testing
1. **Property-Based Testing**
   - Add property-based testing capability
   - Create property generators and checkers
   - Add validation for property test definitions

2. **Behavior Specification**
   - Implement behavior-driven testing syntax
   - Create given-when-then scenario execution
   - Add natural language test reporting

## 4. Core2 Integration

### Phase 1: Runtime Adapters
1. **DSL-to-Runtime Transformation**
   - Create adapter for transforming DSL definitions to Core2 runtime configs
   - Implement attribute processing for runtime configuration
   - Add validation for runtime compatibility

2. **Policy Implementation**
   - Implement policy application in Core2 runtime
   - Create policy handlers for different policy types
   - Add policy composition and conflict resolution

3. **Behavior Composition**
   - Implement behavior composition in Core2 runtime
   - Create behavior merging logic for message handlers and state
   - Add validation for behavior compatibility

### Phase 2: Runtime Optimization
1. **Performance Enhancements**
   - Optimize runtime for attribute-based specialization
   - Implement caching for commonly used patterns
   - Add runtime configuration validation

2. **Multi-Runtime Support**
   - Implement adapters for different runtime environments
   - Create runtime-specific optimizations
   - Add runtime feature detection and capability reporting

## 5. Documentation and Tooling

### Phase 1: Documentation
1. **API Documentation**
   - Create comprehensive API documentation
   - Add examples for common patterns
   - Document attribute-based specialization

2. **Pattern Documentation**
   - Document common patterns and how to implement them
   - Add examples for event sourcing, CQRS, and other patterns
   - Document best practices for component design

### Phase 2: Developer Tooling
1. **DSL Visualization**
   - Create tools for visualizing DSL definitions
   - Implement diagram generation for systems and processes
   - Add runtime visualization for monitoring

2. **Code Generation**
   - Create code generation tools for common patterns
   - Implement boilerplate reduction for attribute-based specialization
   - Add validation for generated code

## Timeline

| Phase | Task | Timeline | Dependencies |
|-------|------|----------|--------------|
| Core Components 1 | Update Component Models | Week 1 | None |
| Core Components 1 | Simplify Component Types | Week 1 | None |
| Core Components 1 | Core DSL Class Enhancement | Week 1 | Update Component Models |
| Core Components 2 | Define Standard Attributes | Week 2 | Core Components 1 |
| Core Components 2 | Attribute Processor | Week 2-3 | Define Standard Attributes |
| Core Components 2 | Behavior Composition | Week 2-3 | Update Component Models |
| Extensions 1 | Convert Workflow Extension | Week 3 | Core Components 2 |
| Extensions 1 | Convert Saga Extension | Week 4 | Core Components 2 |
| Extensions 1 | Other Specialized Extensions | Week 4-5 | Core Components 2 |
| Extensions 2 | Policy Framework | Week 5 | Core Components 2 |
| Extensions 2 | Policy Processors | Week 6 | Policy Framework |
| Testing 1 | Test Component Definition | Week 3 | Core Components 1 |
| Testing 1 | Test Runner | Week 4 | Test Component Definition |
| Testing 2 | Property-Based Testing | Week 7 | Test Runner |
| Testing 2 | Behavior Specification | Week 8 | Test Runner |
| Core2 Integration 1 | DSL-to-Runtime Transformation | Week 5-6 | Core Components 2 |
| Core2 Integration 1 | Policy Implementation | Week 7 | Policy Framework |
| Core2 Integration 1 | Behavior Composition | Week 7-8 | Behavior Composition (Core) |
| Core2 Integration 2 | Performance Enhancements | Week 9 | Core2 Integration 1 |
| Core2 Integration 2 | Multi-Runtime Support | Week 10 | Core2 Integration 1 |
| Documentation 1 | API Documentation | Week 2-10 | Ongoing |
| Documentation 1 | Pattern Documentation | Week 3-10 | Ongoing |
| Documentation 2 | DSL Visualization | Week 9-10 | Core2 Integration 1 |
| Documentation 2 | Code Generation | Week 9-10 | Core2 Integration 1 |

## Success Criteria

1. **Simplified API**: The DSL provides a clean, minimal API that's easy to learn and use.
2. **Composition Over Specialization**: Complex behaviors are achieved through composition rather than specialized components.
3. **Attribute-Based Specialization**: Common patterns are implemented through attributes without requiring new component types.
4. **Declarative End-to-End**: All aspects of the system, including testing, are defined declaratively.
5. **Core2 Integration**: The DSL integrates seamlessly with Core2 runtime for efficient execution.
6. **Backward Compatibility**: Existing code continues to work with the simplified DSL.
7. **Performance**: The simplified approach doesn't compromise on performance.
8. **Developer Experience**: The DSL provides a better developer experience with clearer documentation and tooling. 