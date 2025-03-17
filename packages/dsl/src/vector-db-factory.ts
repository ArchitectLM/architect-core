import { VectorDBAdapter, VectorDBAdapterConfig, VectorDBAdapterFactory } from './types.js';

/**
 * Factory for creating vector database adapters
 */
export class DefaultVectorDBAdapterFactory implements VectorDBAdapterFactory {
  private adapterTypes: Record<string, new (options: any) => VectorDBAdapter> = {};

  /**
   * Register a new adapter type
   * @param type The adapter type name
   * @param adapterClass The adapter class constructor
   */
  registerAdapterType(type: string, adapterClass: new (options: any) => VectorDBAdapter): void {
    this.adapterTypes[type] = adapterClass;
  }

  /**
   * Create a vector database adapter
   * @param config The adapter configuration
   * @returns A vector database adapter instance
   */
  createAdapter(config: VectorDBAdapterConfig): VectorDBAdapter {
    const AdapterClass = this.adapterTypes[config.type];
    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${config.type}`);
    }
    return new AdapterClass(config.options);
  }

  /**
   * Get available adapter types
   * @returns Array of registered adapter type names
   */
  getAvailableAdapterTypes(): string[] {
    return Object.keys(this.adapterTypes);
  }
}

// Create a singleton instance
export const vectorDBAdapterFactory = new DefaultVectorDBAdapterFactory(); 