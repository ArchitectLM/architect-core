/**
 * This file imports and runs only the core tests, excluding the vector-db-adapter tests
 * that require a running ChromaDB instance.
 */

// Import all test files except vector-db-adapter.test.ts
import './component-registry.test.js';
import './system-api.test.js';
import './dsl-builder.test.js';
import './system-loader.test.js';
import './runtime-integration.test.js';
import './dsl-config.test.js'; 