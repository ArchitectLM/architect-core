/**
 * Plugin interface for extending the DSL
 */
export interface Plugin {
  id: string;
  name: string;
  description?: string;
  hooks?: Record<string, any>;
  services?: Record<string, any>;
  initialize?: (runtime: any) => void | Promise<void>;
}

/**
 * Plugin options
 */
export interface PluginOptions {
  id: string;
  name: string;
  description?: string;
  hooks?: Record<string, any>;
  services?: Record<string, any>;
  initialize?: (runtime: any) => void | Promise<void>;
}

/**
 * Define a new plugin
 */
export function definePlugin(options: PluginOptions): Plugin {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    hooks: options.hooks,
    services: options.services,
    initialize: options.initialize
  };
}
