import { BasePlugin, PluginOptions, PluginState } from '../models/plugin-system';
import { Result } from '../models/core-types';
import { DomainError } from '../utils';

/**
 * Template state interface for plugins
 */
export interface TemplatePluginState extends PluginState {
  /** Plugin-specific configuration */
  config: {
    enabled: boolean;
    [key: string]: unknown;
  };
  
  /** Plugin-specific data */
  data: {
    initialized: boolean;
    lastError?: Error;
    [key: string]: unknown;
  };
  
  /** Plugin status */
  status: {
    enabled: boolean;
    lastError?: Error;
    lastActionTimestamp?: number;
    health: 'healthy' | 'degraded' | 'unhealthy';
  };
}

/**
 * Base template for all plugins
 */
export abstract class TemplatePlugin extends BasePlugin<TemplatePluginState> {
  constructor(options: PluginOptions) {
    super(options);
    
    // Initialize default state
    this.state = {
      id: options.id,
      config: {
        enabled: true,
        ...options.config
      },
      data: {
        initialized: false
      },
      status: {
        enabled: false,
        health: 'unhealthy'
      }
    } as TemplatePluginState;
  }

  /**
   * Initialize the plugin
   */
  protected async initializePlugin(config: Record<string, unknown>): Promise<Result<void>> {
    try {
      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.success) {
        return validationResult;
      }

      // Update state
      this.setState({
        config: {
          ...this.state.config,
          ...config
        },
        data: {
          ...this.state.data,
          initialized: true
        },
        status: {
          ...this.state.status,
          health: 'healthy'
        }
      });

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Start the plugin
   */
  protected async startPlugin(): Promise<Result<void>> {
    try {
      if (!this.state.data.initialized) {
        return {
          success: false,
          error: new DomainError('Plugin must be initialized before starting')
        };
      }

      // Update state
      this.setState({
        status: {
          ...this.state.status,
          enabled: true,
          lastActionTimestamp: Date.now()
        }
      });

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Stop the plugin
   */
  protected async stopPlugin(): Promise<Result<void>> {
    try {
      // Update state
      this.setState({
        status: {
          ...this.state.status,
          enabled: false,
          lastActionTimestamp: Date.now()
        }
      });

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Clean up plugin resources
   */
  protected async cleanupPlugin(): Promise<Result<void>> {
    try {
      // Update state
      this.setState({
        status: {
          ...this.state.status,
          enabled: false,
          health: 'unhealthy'
        }
      });

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Validate plugin configuration
   */
  protected validateConfig(config: Record<string, unknown>): Result<void> {
    // Override this method in derived classes to implement specific validation
    return { success: true, value: undefined };
  }

  /**
   * Update plugin health status
   */
  protected updateHealth(status: 'healthy' | 'degraded' | 'unhealthy', details?: Record<string, unknown>): void {
    this.setState({
      status: {
        ...this.state.status,
        health: status,
        lastActionTimestamp: Date.now()
      }
    });
  }

  /**
   * Handle plugin errors
   */
  protected handleError(error: Error): void {
    this.setState({
      status: {
        ...this.state.status,
        health: 'degraded',
        lastError: error,
        lastActionTimestamp: Date.now()
      },
      data: {
        ...this.state.data,
        lastError: error
      }
    });
  }
} 