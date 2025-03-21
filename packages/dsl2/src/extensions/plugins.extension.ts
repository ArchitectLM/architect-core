import { DSL } from '../core/dsl.js';

export interface PluginsExtensionOptions {
  pluginsDir?: string;
  autoRegister?: boolean;
  strictMode?: boolean;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  initialize: (dsl: DSL, config?: any) => any;
  configSchema?: Record<string, any>;
}

export function setupPluginsExtension(dsl: DSL, options?: PluginsExtensionOptions): void {
  // Implementation will be added later
} 