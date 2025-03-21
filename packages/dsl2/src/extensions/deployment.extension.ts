import { DSL } from '../core/dsl.js';

export interface DeploymentExtensionOptions {
  provider?: string;
  region?: string;
  environment?: string;
  enableAutoScaling?: boolean;
}

export interface DeploymentConfig {
  provider: 'aws' | 'azure' | 'gcp' | 'kubernetes';
  resources: {
    compute?: ComputeResource;
    storage?: StorageResource;
    network?: NetworkResource;
  };
  scaling?: {
    min: number;
    max: number;
    target: number;
  };
}

export interface ComputeResource {
  type: string;
  size: string;
  replicas: number;
}

export interface StorageResource {
  type: string;
  size: string;
  persistent: boolean;
}

export interface NetworkResource {
  type: string;
  ports: number[];
  ingress?: Record<string, any>;
}

export function setupDeploymentExtension(dsl: DSL, options?: DeploymentExtensionOptions): void {
  // Implementation will be added later
} 