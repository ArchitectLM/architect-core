import { DSL } from '../core/dsl.js';

export interface BillingExtensionOptions {
  defaultProvider?: string;
  currency?: string;
  taxConfiguration?: {
    enabled: boolean;
    rates: Record<string, number>;
  };
}

export interface BillingPlan {
  id: string;
  name: string;
  basePrice: number;
  features: string[];
  tiers?: BillingTier[];
  meteredFeatures?: MeteredFeature[];
}

export interface BillingTier {
  name: string;
  threshold: number | null;
  unitPrice: number;
}

export interface MeteredFeature {
  name: string;
  unitPrice: number;
  billingModel: 'per-unit' | 'tiered';
  unit?: string;
}

export interface BillingProvider {
  ref: string;
  config?: Record<string, any>;
}

export function setupBillingExtension(dsl: DSL, options?: BillingExtensionOptions): void {
  // Implementation will be added later
} 