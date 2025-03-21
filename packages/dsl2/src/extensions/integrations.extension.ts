import { DSL } from '../core/dsl.js';

export interface IntegrationsExtensionOptions {
  enableWebhooks?: boolean;
  enableAPI?: boolean;
  enableClients?: boolean;
}

export interface WebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  authentication?: {
    type: 'basic' | 'bearer' | 'custom';
    credentials?: Record<string, string>;
  };
}

export interface APIConfig {
  type: 'rest' | 'graphql';
  basePath?: string;
  version?: string;
  auth?: {
    type: 'jwt' | 'oauth2' | 'apikey';
    config: Record<string, any>;
  };
}

export interface ClientConfig {
  type: string;
  config: Record<string, any>;
  retry?: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
  };
}

export function setupIntegrationsExtension(dsl: DSL, options?: IntegrationsExtensionOptions): void {
  // Implementation will be added later
} 