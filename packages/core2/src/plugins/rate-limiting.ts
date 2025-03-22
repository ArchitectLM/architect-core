import { EventBus } from '../models/event-system';
import { BasePlugin, PluginOptions } from '../models/plugin-system';
import { 
  ExtensionPointNames, 
  ExtensionPointName, 
  ExtensionPointParameters, 
  ExtensionHook, 
  ExtensionHookRegistration,
  ExtensionContext
} from '../models/extension-system';
import { Result } from '../models/core-types';

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
export class TaskRateLimiter {
  protected tokens: number;
  protected lastRefillTime: number;
  protected tokensPerInterval: number;
  protected interval: number;
  protected burstLimit: number;
  protected disabled: boolean;
  protected totalExecutions: number = 0;
  protected rejectionCount: number = 0;
  
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
  protected refillTokens(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    
    if (elapsedTime < this.interval) {
      return;
    }
    
    // Calculate number of complete intervals elapsed
    const intervals = Math.floor(elapsedTime / this.interval);
    
    // Calculate tokens to add based on complete intervals
    const tokensToAdd = intervals * this.tokensPerInterval;
    
    if (tokensToAdd > 0) {
      // Update tokens, ensuring we don't exceed max capacity
      this.tokens = Math.min(
        this.tokensPerInterval + this.burstLimit,
        this.tokens + tokensToAdd
      );
      
      // Update last refill time to account for all used intervals
      this.lastRefillTime = now - (elapsedTime % this.interval);
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
      tokensRemaining: Math.max(0, this.tokens),
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
export class RateLimitingPlugin extends BasePlugin {
  protected rateLimiters: Map<string, TaskRateLimiter> = new Map();
  protected defaultLimitOptions: RateLimitOptions;
  protected eventBus: EventBus;
  
  constructor(options: RateLimitingPluginOptions, eventBus: EventBus) {
    super({
      id: 'rate-limiting-plugin',
      name: 'Rate Limiting Plugin',
      description: 'Limits the rate of task execution to prevent system overload',
      config: { defaultLimit: options.defaultLimit }
    });
    
    this.defaultLimitOptions = options.defaultLimit;
    this.eventBus = eventBus;

    // Register hooks
    this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (
      params: ExtensionPointParameters[typeof ExtensionPointNames.TASK_BEFORE_EXECUTION],
      context: ExtensionContext<unknown>
    ) => {
      const { taskId } = params;
      if (!taskId) {
        return { success: true, value: params };
      }

      const limiter = this.getRateLimiter(taskId);
      
      if (!limiter.consumeToken()) {
        const error = new Error(`Rate limit exceeded for task '${taskId}'. Please try again later.`);
        error.name = 'RateLimitExceededError';
        throw error;
      }
      
      return { success: true, value: params };
    });

    this.registerHook(ExtensionPointNames.TASK_AFTER_EXECUTION, async (
      params: ExtensionPointParameters[typeof ExtensionPointNames.TASK_AFTER_EXECUTION],
      context: ExtensionContext<unknown>
    ) => {
      const { taskId } = params;
      if (!taskId) {
        return { success: true, value: params };
      }

      const limiter = this.getRateLimiter(taskId);
      
      // Update statistics on completion
      const stats = limiter.getStats();
      
      // Only publish if event bus is available
      if (this.eventBus) {
        try {
          await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'rate-limiting.stats',
            timestamp: Date.now(),
            payload: {
              taskId,
              stats,
              timestamp: Date.now()
            }
          });
        } catch (error) {
          // Log error but don't fail the hook
          console.error('Failed to publish rate limiting stats:', error);
        }
      }
      
      return { success: true, value: params };
    });
  }
  
  /**
   * Set a custom rate limit for a specific task
   */
  setTaskRateLimit(taskId: string, options: Partial<RateLimitOptions>): void {
    const limiter = this.getRateLimiter(taskId);
    const currentConfig = {
      tokensPerInterval: limiter.getStats().tokensRemaining,
      interval: this.defaultLimitOptions.interval,
      burstLimit: this.defaultLimitOptions.burstLimit,
      disabled: false
    };
    limiter.updateConfig({ ...currentConfig, ...options });
  }
  
  /**
   * Get the rate limiter for a task, creating a new one if needed
   */
  protected getRateLimiter(taskId: string): TaskRateLimiter {
    if (!this.rateLimiters.has(taskId)) {
      this.rateLimiters.set(taskId, new TaskRateLimiter(this.defaultLimitOptions));
    }
    
    return this.rateLimiters.get(taskId)!;
  }
  
  /**
   * Get rate limiting statistics for a task
   */
  getTaskStats(taskId: string): RateLimitStats {
    const limiter = this.getRateLimiter(taskId);
    return limiter.getStats();
  }
  
  /**
   * Reset rate limiting for a task
   */
  resetTask(taskId: string): void {
    const limiter = this.getRateLimiter(taskId);
    limiter.reset();
  }
  
  /**
   * Reset rate limiting for all tasks
   */
  resetAll(): void {
    for (const limiter of this.rateLimiters.values()) {
      limiter.reset();
    }
  }
}

/**
 * Create a new Rate Limiting Plugin
 */
export function createRateLimitingPlugin(options: RateLimitingPluginOptions, eventBus: EventBus): RateLimitingPlugin {
  return new RateLimitingPlugin(options, eventBus);
} 