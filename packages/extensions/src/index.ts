/**
 * @file Entry point for the @architectlm/extensions package
 * @module @architectlm/extensions
 */

// Export models
export * from "./models.js";

// Export implementation
export {
  DefaultExtensionSystem,
  createExtensionSystem,
} from "./extension-system.js";
