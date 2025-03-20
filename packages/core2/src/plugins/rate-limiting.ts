import { Extension } from '../models/extension.js';
import { EventBus } from '../models/event.js';

/**
 * Rate limiting configuration for tasks
 */
export interface RateLimitOptions {
  /**
   * Number of tokens (executions) allowed per interval
   */
  tokensPerInterval: number;
  
  /**
   * Time interval in milliseconds
   */
  interval: number;
  
  /**
   * Additional tokens allowed for burst traffic
   */
  burstLimit?: number;
  
  /**
   * Whether rate limiting is disabled for this task
   */
  disabled?: boolean;
}

/**
 * Rate limiting statistics for a task
 */
export interface RateLimitStats {
  /**
   * Number of tokens remaining in the current interval
   */
  tokensRemaining: number;
  
  /**
   * Total number of successful executions
   */
  totalExecutions: number;
  
  /**
   * Number of rejected executions due to rate limiting
   */
  rejections: number;
  
  /**
   * Time when the rate limiter will reset (in milliseconds since epoch)
   */
  resetTime: number;
}

/**
 * Plugin configuration options
 */
export interface RateLimitingPluginOptions {
  /**
   * Default rate limit applied to all tasks
   */
  defaultLimit: RateLimitOptions;
}

/**
 * Rate limiter for a specific task
 */
class TaskRateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private tokensPerInterval: number;
  private interval: number;
  private burstLimit: number;
  private disabled: boolean;
  private totalExecutions: number = 0;
  private rejectionCount: number = 0;
  
  constructor(options: RateLimitOptions) {
    this.tokensPerInterval = options.tokensPerInterval;
    this.interval = options.interval;
    this.burstLimit = options.burstLimit || 0;
    this.disabled = options.disabled || false;
    
    // Initialize with full tokens plus burst
    this.tokens = this.tokensPerInterval + this.burstLimit;
    this.lastRefillTime = Date.now();
  }
  
  /**
   * Check if a task can be executed
   * @returns true if the task can be executed, false otherwise
   */
  canExecute(): boolean {
    if (this.disabled) {
      return true;
    }
    
    this.refillTokens();
    return this.tokens > 0;
  }
  
  /**
   * Consume a token for task execution
   * @returns true if a token was consumed, false if no tokens available
   */
  consumeToken(): boolean {
    if (this.disabled) {
      this.totalExecutions++;
      return true;
    }
    
    this.refillTokens();
    
    if (this.tokens <= 0) {
      this.rejectionCount++;
      return false;
    }
    
    this.tokens--;
    this.totalExecutions++;
    return true;
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    
    if (elapsedTime <= 0) {
      return;
    }
    
    // Calculate token refill based on time elapsed
    const tokensToAdd = Math.floor((elapsedTime / this.interval) * this.tokensPerInterval);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokensPerInterval + this.burstLimit, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }
  
  /**
   * Reset the rate limiter to its initial state
   */
  reset(): void {
    this.tokens = this.tokensPerInterval + this.burstLimit;
    this.lastRefillTime = Date.now();
  }
  
  /**
   * Get statistics about this rate limiter
   */
  getStats(): RateLimitStats {
    this.refillTokens();
    
    return {
      tokensRemaining: this.tokens,
      totalExecutions: this.totalExecutions,
      rejections: this.rejectionCount,
      resetTime: this.lastRefillTime + this.interval
    };
  }
  
  /**
   * Update the limiter configuration
   */
  updateConfig(options: RateLimitOptions): void {
    this.tokensPerInterval = options.tokensPerInterval;
    this.interval = options.interval;
    this.burstLimit = options.burstLimit || 0;
    this.disabled = options.disabled || false;
    
    // Refill tokens based on new configuration
    this.reset();
  }
}

/**
 * Plugin for rate limiting task execution to prevent system overload
 */
export class RateLimitingPlugin implements Extension {
  name = 'rate-limiting-plugin';
  description = 'Limits the rate of task execution to prevent system overload';
  
  private rateLimiters: Map<string, TaskRateLimiter> = new Map();
  private defaultLimitOptions: RateLimitOptions;
  
  constructor(options: RateLimitingPluginOptions) {
    this.defaultLimitOptions = options.defaultLimit;
  }
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const { taskId } = context;
      const limiter = this.getRateLimiter(taskId);
      
      if (!limiter.consumeToken()) {
        throw new Error(`Rate limit exceeded for task '${taskId}'. Please try again later.`);
      }
      
      return context;
    }
  };
  
  /**
   * Set a custom rate limit for a specific task
   */
  setTaskRateLimit(taskId: string, options: Partial<RateLimitOptions>): void {
    const limiter = this.getRateLimiter(taskId);
    
    // Merge with default options
    const mergedOptions: RateLimitOptions = {
      ...this.defaultLimitOptions,
      ...options
    };
    
    // Update existing limiter
    limiter.updateConfig(mergedOptions);
  }
  
  /**
   * Reset a rate limiter for a specific task
   */
  resetRateLimiter(taskId: string): void {
    const limiter = this.getRateLimiter(taskId);
    limiter.reset();
  }
  
  /**
   * Get statistics for a task's rate limiter
   */
  getRateLimitStats(taskId: string): RateLimitStats {
    const limiter = this.getRateLimiter(taskId);
    return limiter.getStats();
  }
  
  /**
   * Get or create a rate limiter for a task
   */
  private getRateLimiter(taskId: string): TaskRateLimiter {
    if (!this.rateLimiters.has(taskId)) {
      this.rateLimiters.set(taskId, new TaskRateLimiter(this.defaultLimitOptions));
    }
    
    return this.rateLimiters.get(taskId)!;
  }
}

/**
 * Create a new Rate Limiting Plugin
 */
export function createRateLimitingPlugin(options: RateLimitingPluginOptions): Extension {
  return new RateLimitingPlugin(options);
} 