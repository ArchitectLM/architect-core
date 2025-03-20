/**
 * Rate Limiter Extension Implementation
 * 
 * This module provides an implementation of the Rate Limiter pattern as an extension,
 * which limits the rate of operations to prevent system overload.
 */

import { Extension } from '../extension-system.js';

/**
 * Rate limiting strategies
 */
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed-window',
  SLIDING_WINDOW = 'sliding-window',
  TOKEN_BUCKET = 'token-bucket'
}

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  /**
   * The rate limiting strategy to use
   */
  strategy: RateLimitStrategy;
  
  /**
   * The maximum number of operations allowed in the time window
   */
  limit: number;
  
  /**
   * The time window in milliseconds
   * Required for FIXED_WINDOW and SLIDING_WINDOW strategies
   */
  window?: number;
  
  /**
   * The rate at which tokens are added to the bucket
   * Required for TOKEN_BUCKET strategy
   */
  refillRate?: number;
  
  /**
   * The interval at which tokens are added to the bucket in milliseconds
   * Required for TOKEN_BUCKET strategy
   */
  refillInterval?: number;
  
  /**
   * Called when rate limit is exceeded
   */
  onThrottled?: (context: RateLimitThrottlingContext) => void;
}

/**
 * Context for rate limit throttling events
 */
export interface RateLimitThrottlingContext {
  /**
   * Name of the rate limiter
   */
  name: string;
  
  /**
   * Current usage count
   */
  currentUsage: number;
  
  /**
   * Maximum allowed limit
   */
  limit: number;
  
  /**
   * Percentage of limit used (0-1)
   */
  usagePercentage: number;
  
  /**
   * Timestamp of the throttling
   */
  timestamp: number;
  
  /**
   * Time until reset in milliseconds
   */
  resetIn?: number;
}

/**
 * Context for rate limiter configuration
 */
export interface RateLimiterConfigContext {
  /**
   * Name of the rate limiter
   */
  name: string;
  
  /**
   * Current configuration
   */
  config: RateLimiterOptions;
  
  /**
   * Additional context information
   */
  context?: Record<string, any>;
}

// Define state types for each strategy
interface FixedWindowState {
  windowStart: number;
  count: number;
}

interface SlidingWindowState {
  timestamps: number[];
}

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
}

// Union type for all possible states
type RateLimiterState = FixedWindowState | SlidingWindowState | TokenBucketState;

/**
 * Rate limiter extension that provides rate limiting functionality
 */
export class RateLimiterExtension implements Extension {
  name = 'rate-limiter';
  description = 'Provides rate limiting pattern implementation';
  
  private rateLimiters: Map<string, {
    options: RateLimiterOptions;
    state: RateLimiterState;
  }> = new Map();
  
  /**
   * Create a new rate limiter
   * 
   * @param name The name of the rate limiter
   * @param options Rate limiter options
   */
  createRateLimiter(name: string, options: RateLimiterOptions): void {
    this.validateOptions(options);
    
    let state: RateLimiterState;
    
    // Initialize state based on strategy
    switch (options.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        state = {
          windowStart: Date.now(),
          count: 0
        };
        break;
        
      case RateLimitStrategy.SLIDING_WINDOW:
        state = {
          timestamps: []
        };
        break;
        
      case RateLimitStrategy.TOKEN_BUCKET:
        state = {
          tokens: options.limit,
          lastRefill: Date.now()
        };
        break;
        
      default:
        throw new Error(`Unsupported rate limiting strategy: ${options.strategy}`);
    }
    
    this.rateLimiters.set(name, {
      options,
      state
    });
  }
  
  /**
   * Validate rate limiter options
   * 
   * @param options Rate limiter options
   */
  private validateOptions(options: RateLimiterOptions): void {
    if (options.limit <= 0) {
      throw new Error('limit must be greater than 0');
    }
    
    switch (options.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
      case RateLimitStrategy.SLIDING_WINDOW:
        if (!options.window || options.window <= 0) {
          throw new Error('window must be greater than 0 for fixed/sliding window strategies');
        }
        break;
        
      case RateLimitStrategy.TOKEN_BUCKET:
        if (!options.refillRate || options.refillRate <= 0) {
          throw new Error('refillRate must be greater than 0 for token bucket strategy');
        }
        
        if (!options.refillInterval || options.refillInterval <= 0) {
          throw new Error('refillInterval must be greater than 0 for token bucket strategy');
        }
        break;
    }
  }
  
  /**
   * Check if an operation is allowed by the rate limiter
   * 
   * @param name The name of the rate limiter
   * @returns Whether the operation is allowed
   */
  isAllowed(name: string): boolean {
    const rateLimiter = this.rateLimiters.get(name);
    
    if (!rateLimiter) {
      throw new Error(`Rate limiter '${name}' not found`);
    }
    
    const { options, state } = rateLimiter;
    const now = Date.now();
    
    switch (options.strategy) {
      case RateLimitStrategy.FIXED_WINDOW: {
        const fixedWindowState = state as FixedWindowState;
        // Check if window has expired
        if (now - fixedWindowState.windowStart > options.window!) {
          // Reset window
          fixedWindowState.windowStart = now;
          fixedWindowState.count = 0;
        }
        
        // Check if limit is reached
        if (fixedWindowState.count >= options.limit) {
          this.triggerThrottling(
            name,
            fixedWindowState.count,
            options.limit,
            fixedWindowState.windowStart + options.window! - now
          );
          return false;
        }
        
        // Increment count
        fixedWindowState.count++;
        return true;
      }
        
      case RateLimitStrategy.SLIDING_WINDOW: {
        const slidingWindowState = state as SlidingWindowState;
        // Remove expired timestamps
        slidingWindowState.timestamps = slidingWindowState.timestamps.filter(
          (timestamp: number) => now - timestamp <= options.window!
        );
        
        // Check if limit is reached
        if (slidingWindowState.timestamps.length >= options.limit) {
          // Calculate time until oldest timestamp expires
          const oldestTimestamp = slidingWindowState.timestamps[0];
          const resetIn = oldestTimestamp + options.window! - now;
          
          this.triggerThrottling(
            name,
            slidingWindowState.timestamps.length,
            options.limit,
            resetIn
          );
          return false;
        }
        
        // Add current timestamp
        slidingWindowState.timestamps.push(now);
        return true;
      }
        
      case RateLimitStrategy.TOKEN_BUCKET: {
        const tokenBucketState = state as TokenBucketState;
        // Refill tokens
        const elapsedTime = now - tokenBucketState.lastRefill;
        const refillCount = Math.floor(elapsedTime / options.refillInterval!);
        
        if (refillCount > 0) {
          tokenBucketState.tokens = Math.min(
            options.limit,
            tokenBucketState.tokens + refillCount * options.refillRate!
          );
          tokenBucketState.lastRefill = now;
        }
        
        // Check if tokens are available
        if (tokenBucketState.tokens < 1) {
          // Calculate time until next token is available
          const timeUntilNextToken = options.refillInterval! - (now - tokenBucketState.lastRefill);
          
          this.triggerThrottling(
            name,
            options.limit - tokenBucketState.tokens,
            options.limit,
            timeUntilNextToken
          );
          return false;
        }
        
        // Consume token
        tokenBucketState.tokens--;
        return true;
      }
        
      default:
        throw new Error(`Unsupported rate limiting strategy: ${options.strategy}`);
    }
  }
  
  /**
   * Execute a function with rate limiting
   * 
   * @param name The name of the rate limiter
   * @param fn The function to execute
   * @returns The result of the function
   * @throws Error if rate limit is exceeded
   */
  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (this.isAllowed(name)) {
      return await fn();
    } else {
      throw new Error('Rate limit exceeded');
    }
  }
  
  /**
   * Trigger the rate limit throttling extension point
   * 
   * @param name The name of the rate limiter
   * @param currentUsage The current usage count
   * @param limit The maximum allowed limit
   * @param resetIn Time until reset in milliseconds
   */
  private triggerThrottling(
    name: string,
    currentUsage: number,
    limit: number,
    resetIn?: number
  ): void {
    const context: RateLimitThrottlingContext = {
      name,
      currentUsage,
      limit,
      usagePercentage: currentUsage / limit,
      timestamp: Date.now(),
      resetIn
    };
    
    // Call the onThrottled handler if provided
    const rateLimiter = this.rateLimiters.get(name);
    if (rateLimiter && rateLimiter.options.onThrottled) {
      rateLimiter.options.onThrottled(context);
    }
    
    // This will be handled by the extension system
    this.hooks['rateLimit.throttled'](context);
  }
  
  hooks = {
    'rateLimit.create': (context: { name: string; options: RateLimiterOptions }) => {
      const { name, options } = context;
      this.createRateLimiter(name, options);
      return { name, created: true };
    },
    
    'rateLimit.isAllowed': (context: { name: string }) => {
      const { name } = context;
      return this.isAllowed(name);
    },
    
    'rateLimit.execute': async (context: { name: string; fn: () => Promise<any> }) => {
      const { name, fn } = context;
      return await this.execute(name, fn);
    },
    
    'rateLimit.throttled': (context: RateLimitThrottlingContext) => {
      // This is a notification hook, no return value needed
      return context;
    },
    
    'rateLimit.configure': (context: RateLimiterConfigContext) => {
      const { name, config, context: additionalContext } = context;
      
      // Allow extensions to modify the configuration
      // This is useful for contextual policies
      return config;
    }
  };
} 