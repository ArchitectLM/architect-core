import { Extension } from '../extension-system.js';
import { BackoffStrategy } from '../models.js';

/**
 * Type definition for a backoff strategy function
 */
export type BackoffStrategyFn = (attempt: number, initialDelay: number) => number;

/**
 * Interface for the context passed to the backoff strategy extension point
 */
export interface BackoffStrategyContext {
  /** The name of the strategy to use */
  strategyName: string | BackoffStrategy;
  /** The initial delay in milliseconds */
  initialDelay: number;
  /** Additional options for the strategy */
  options?: Record<string, any>;
}

/**
 * Type definition for a system load provider function
 */
export type SystemLoadProvider = () => number;

/**
 * Type definition for a custom strategy provider function
 */
export type CustomStrategyProvider = (options?: Record<string, any>) => BackoffStrategyFn;

/**
 * Extension that provides custom backoff strategies for retry policies
 */
export class BackoffStrategyExtension implements Extension {
  name = 'backoff-strategy';
  description = 'Provides custom backoff strategies for retry policies';
  
  private customStrategies: Map<string, CustomStrategyProvider | BackoffStrategyFn> = new Map();
  private systemLoadProvider: SystemLoadProvider = () => 0.5; // Default to 50% load
  
  constructor() {
    // Register built-in custom strategies
    this.registerCustomStrategy('adaptive', this.createAdaptiveBackoff.bind(this));
    this.registerCustomStrategy('stepped', this.createSteppedBackoff.bind(this));
  }
  
  /**
   * Set the system load provider function
   * @param provider The function that provides the current system load (0-1)
   */
  setSystemLoadProvider(provider: SystemLoadProvider): void {
    this.systemLoadProvider = provider;
  }
  
  /**
   * Register a custom backoff strategy
   * @param name The name of the strategy
   * @param provider The function that provides the strategy or a direct strategy function
   */
  registerCustomStrategy(name: string, provider: CustomStrategyProvider | BackoffStrategyFn): void {
    this.customStrategies.set(name, provider);
  }
  
  /**
   * Create an adaptive backoff strategy that adjusts based on system load
   * @param options Options for the adaptive strategy
   * @returns A backoff strategy function
   */
  private createAdaptiveBackoff(options?: Record<string, any>): BackoffStrategyFn {
    const baseFactor = options?.baseFactor || 1.5;
    
    return (attempt: number, initialDelay: number) => {
      // Get the current system load (0-1)
      const load = this.systemLoadProvider();
      
      // Calculate the base delay using exponential backoff
      const baseDelay = initialDelay * Math.pow(baseFactor, attempt - 1);
      
      // Adjust the delay based on system load
      // Higher load = longer delay (up to 3x at 100% load)
      const loadMultiplier = 1 + (load * 2);
      
      return Math.floor(baseDelay * loadMultiplier);
    };
  }
  
  /**
   * Create a stepped backoff strategy that increases delay in steps
   * @param options Options for the stepped strategy
   * @returns A backoff strategy function
   */
  private createSteppedBackoff(options?: Record<string, any>): BackoffStrategyFn {
    // Define the steps with attempt ranges and multipliers
    const steps = options?.steps || [
      { max: 2, multiplier: 1 },    // Attempts 1-2: initialDelay
      { max: 5, multiplier: 3 },    // Attempts 3-5: initialDelay * 3
      { max: 10, multiplier: 7 },   // Attempts 6-10: initialDelay * 7
      { max: Infinity, multiplier: 15 } // Attempts 11+: initialDelay * 15
    ];
    
    return (attempt: number, initialDelay: number) => {
      // Find the appropriate step for this attempt
      const step = steps.find((s: { max: number; multiplier: number }) => attempt <= s.max);
      
      // Apply the multiplier
      return initialDelay * (step?.multiplier || 1);
    };
  }
  
  hooks = {
    'backoff.getStrategy': (context: BackoffStrategyContext) => {
      const { strategyName, options } = context;
      
      // Check if we have a custom strategy with this name
      if (typeof strategyName === 'string' && this.customStrategies.has(strategyName)) {
        const provider = this.customStrategies.get(strategyName);
        if (provider) {
          // If the provider is a function that takes options and returns a strategy function
          if (typeof provider === 'function') {
            // Check if it's a CustomStrategyProvider (takes options) or a direct BackoffStrategyFn
            if (provider.length <= 1) {
              // It's a CustomStrategyProvider, call it with options to get the strategy function
              return provider(options);
            } else {
              // It's already a BackoffStrategyFn, return it directly
              return provider;
            }
          }
        }
      }
      
      // Return null to allow fallback to core strategies
      return null;
    }
  };
} 