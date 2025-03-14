/**
 * Reactive Runtime for ArchitectLM
 * 
 * This class implements the Runtime interface using the ProcessManager and TaskManager.
 * It provides a reactive event-driven architecture for process and task execution.
 */

import { ReactiveEventBus } from '../../event-bus';
import { ProcessManager } from './process-manager';
import { TaskManager, TaskMiddleware, ExtendedTaskOptions } from './task-manager';
import { 
  Runtime, 
  ProcessInstance, 
  ProcessDefinition, 
  TaskDefinition,
  Event, 
  EventHandler, 
  Subscription,
  ProcessOptions,
  TaskOptions,
  TestDefinition,
  TestOptions,
  TestResult,
  TestSuite,
  TestSuiteResult,
  TaskContext,
  SystemConfig,
  TestStepResult
} from '../../models';
import { v4 as uuidv4 } from 'uuid';
import { Plugin } from '../../dsl/plugin';

/**
 * Hook function type for runtime hooks
 */
export type HookFunction = (...args: any[]) => void | Promise<void>;

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Default console logger
 */
export class ConsoleLogger implements Logger {
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
  
  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
  startTimer(name: string, tags?: Record<string, string>): () => number;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
}

/**
 * No-op metrics collector
 */
export class NoopMetricsCollector implements MetricsCollector {
  incrementCounter(): void {}
  recordGauge(): void {}
  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
  recordHistogram(): void {}
}

/**
 * Cache interface for performance optimization
 */
export interface Cache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
}

/**
 * LRU Cache implementation
 */
export class LRUCache<K, V> implements Cache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(maxSize: number = 100) {
    this.cache = new Map<K, V>();
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to the end to mark as recently used
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }
  
  set(key: K, value: V): void {
    // If cache is full, remove the least recently used item (first item)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }
  
  getStats(): { hits: number; misses: number; hitRatio: number } {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? this.hits / total : 0;
    return { hits: this.hits, misses: this.misses, hitRatio };
  }
}

/**
 * Asynchronous cache interface for distributed caching
 */
export interface AsyncCache<K, V> {
  getAsync(key: K): Promise<V | undefined>;
  setAsync(key: K, value: V): Promise<void>;
  hasAsync(key: K): Promise<boolean>;
  deleteAsync(key: K): Promise<boolean>;
  clearAsync(): Promise<void>;
  sizeAsync(): Promise<number>;
  getStatsAsync(): Promise<any>;
}

/**
 * Distributed cache provider interface
 */
export interface DistributedCacheProvider {
  /**
   * Get a value from the distributed cache
   */
  get<T>(key: string): Promise<T | undefined>;
  
  /**
   * Set a value in the distributed cache
   */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  
  /**
   * Delete a value from the distributed cache
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear all values from the distributed cache
   */
  clear(): Promise<void>;
  
  /**
   * Check if a key exists in the distributed cache
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Get the number of items in the distributed cache
   */
  size(): Promise<number>;
  
  /**
   * Get cache statistics
   */
  getStats(): Promise<any>;
}

/**
 * Distributed cache implementation that wraps a local cache with a distributed cache provider
 */
export class DistributedCache<K, V> implements Cache<K, V>, AsyncCache<K, V> {
  private localCache: Cache<K, V>;
  private provider: DistributedCacheProvider;
  private prefix: string;
  private ttlMs?: number;
  private logger: Logger;
  
  constructor(
    localCache: Cache<K, V>,
    provider: DistributedCacheProvider,
    prefix: string = '',
    ttlMs?: number,
    logger?: Logger
  ) {
    this.localCache = localCache;
    this.provider = provider;
    this.prefix = prefix;
    this.ttlMs = ttlMs;
    this.logger = logger || new ConsoleLogger();
  }
  
  /**
   * Generate a distributed cache key
   */
  private getDistributedKey(key: K): string {
    return `${this.prefix}:${String(key)}`;
  }
  
  /**
   * Get a value from the cache asynchronously
   */
  async getAsync(key: K): Promise<V | undefined> {
    // Check local cache first
    const localValue = this.localCache.get(key);
    if (localValue !== undefined) {
      return localValue;
    }
    
    try {
      // Try to get from distributed cache
      const distributedKey = this.getDistributedKey(key);
      const distributedValue = await this.provider.get<V>(distributedKey);
      
      if (distributedValue !== undefined) {
        // Update local cache
        this.localCache.set(key, distributedValue);
        return distributedValue;
      }
    } catch (error) {
      this.logger.warn(`Error getting value from distributed cache: ${error}`);
    }
    
    return undefined;
  }
  
  /**
   * Get a value from the cache synchronously (falls back to local cache only)
   */
  get(key: K): V | undefined {
    return this.localCache.get(key);
  }
  
  /**
   * Set a value in the cache asynchronously
   */
  async setAsync(key: K, value: V): Promise<void> {
    // Update local cache
    this.localCache.set(key, value);
    
    try {
      // Update distributed cache
      const distributedKey = this.getDistributedKey(key);
      await this.provider.set(distributedKey, value, this.ttlMs);
    } catch (error) {
      this.logger.warn(`Error setting value in distributed cache: ${error}`);
    }
  }
  
  /**
   * Set a value in the cache synchronously (updates local cache only)
   */
  set(key: K, value: V): void {
    this.localCache.set(key, value);
    
    // Asynchronously update the distributed cache
    const distributedKey = this.getDistributedKey(key);
    this.provider.set(distributedKey, value, this.ttlMs).catch(error => {
      this.logger.warn(`Error setting value in distributed cache: ${error}`);
    });
  }
  
  /**
   * Check if a key exists in the cache asynchronously
   */
  async hasAsync(key: K): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return true;
    }
    
    try {
      // Check distributed cache
      const distributedKey = this.getDistributedKey(key);
      const exists = await this.provider.has(distributedKey);
      return exists;
    } catch (error) {
      this.logger.warn(`Error checking key in distributed cache: ${error}`);
      return false;
    }
  }
  
  /**
   * Check if a key exists in the cache synchronously (falls back to local cache only)
   */
  has(key: K): boolean {
    return this.localCache.has(key);
  }
  
  /**
   * Delete a value from the cache asynchronously
   */
  async deleteAsync(key: K): Promise<boolean> {
    // Delete from local cache
    const localResult = this.localCache.delete(key);
    
    try {
      // Delete from distributed cache
      const distributedKey = this.getDistributedKey(key);
      await this.provider.delete(distributedKey);
    } catch (error) {
      this.logger.warn(`Error deleting value from distributed cache: ${error}`);
    }
    
    return localResult;
  }
  
  /**
   * Delete a value from the cache synchronously (updates local cache only)
   */
  delete(key: K): boolean {
    const result = this.localCache.delete(key);
    
    // Asynchronously delete from the distributed cache
    const distributedKey = this.getDistributedKey(key);
    this.provider.delete(distributedKey).catch(error => {
      this.logger.warn(`Error deleting value from distributed cache: ${error}`);
    });
    
    return result;
  }
  
  /**
   * Clear the cache asynchronously
   */
  async clearAsync(): Promise<void> {
    // Clear local cache
    this.localCache.clear();
    
    try {
      // Clear distributed cache (only keys with our prefix)
      await this.provider.clear();
    } catch (error) {
      this.logger.warn(`Error clearing distributed cache: ${error}`);
    }
  }
  
  /**
   * Clear the cache synchronously (clears local cache only)
   */
  clear(): void {
    this.localCache.clear();
    
    // Asynchronously clear the distributed cache
    this.provider.clear().catch(error => {
      this.logger.warn(`Error clearing distributed cache: ${error}`);
    });
  }
  
  /**
   * Get the number of items in the cache asynchronously
   */
  async sizeAsync(): Promise<number> {
    try {
      // Get size from distributed cache
      return await this.provider.size();
    } catch (error) {
      this.logger.warn(`Error getting size from distributed cache: ${error}`);
      return this.localCache.size();
    }
  }
  
  /**
   * Get the number of items in the cache synchronously (falls back to local cache only)
   */
  size(): number {
    return this.localCache.size();
  }
  
  /**
   * Get cache statistics asynchronously
   */
  async getStatsAsync(): Promise<any> {
    try {
      // Get stats from distributed cache
      const distributedStats = await this.provider.getStats();
      
      // Get stats from local cache if it's an LRUCache
      let localStats = null;
      if (this.localCache instanceof LRUCache) {
        localStats = (this.localCache as LRUCache<K, V>).getStats();
      }
      
      return {
        local: localStats,
        distributed: distributedStats
      };
    } catch (error) {
      this.logger.warn(`Error getting stats from distributed cache: ${error}`);
      
      // Get stats from local cache if it's an LRUCache
      let localStats = null;
      if (this.localCache instanceof LRUCache) {
        localStats = (this.localCache as LRUCache<K, V>).getStats();
      }
      
      return {
        local: localStats,
        distributed: null
      };
    }
  }
}

/**
 * Redis distributed cache provider implementation
 */
export class RedisDistributedCacheProvider implements DistributedCacheProvider {
  private client: any; // Redis client
  private prefix: string;
  private logger: Logger;
  
  constructor(client: any, prefix: string = 'cache', logger?: Logger) {
    this.client = client;
    this.prefix = prefix;
    this.logger = logger || new ConsoleLogger();
  }
  
  /**
   * Get a prefixed key
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
  
  /**
   * Get a value from the distributed cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const prefixedKey = this.getKey(key);
      const value = await this.client.get(prefixedKey);
      
      if (value) {
        return JSON.parse(value) as T;
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Redis cache get error: ${error}`);
      return undefined;
    }
  }
  
  /**
   * Set a value in the distributed cache
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);
      
      if (ttlMs) {
        await this.client.set(prefixedKey, serializedValue, 'PX', ttlMs);
      } else {
        await this.client.set(prefixedKey, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Redis cache set error: ${error}`);
    }
  }
  
  /**
   * Delete a value from the distributed cache
   */
  async delete(key: string): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      await this.client.del(prefixedKey);
    } catch (error) {
      this.logger.error(`Redis cache delete error: ${error}`);
    }
  }
  
  /**
   * Clear all values from the distributed cache with the current prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.prefix}:*`);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Redis cache clear error: ${error}`);
    }
  }
  
  /**
   * Check if a key exists in the distributed cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const exists = await this.client.exists(prefixedKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Redis cache has error: ${error}`);
      return false;
    }
  }
  
  /**
   * Get the number of items in the distributed cache with the current prefix
   */
  async size(): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.prefix}:*`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Redis cache size error: ${error}`);
      return 0;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.client.info();
      const keyCount = await this.size();
      
      return {
        keyCount,
        info
      };
    } catch (error) {
      this.logger.error(`Redis cache stats error: ${error}`);
      return {
        keyCount: 0,
        info: null
      };
    }
  }
}

/**
 * In-memory distributed cache provider implementation (for testing)
 */
export class InMemoryDistributedCacheProvider implements DistributedCacheProvider {
  private static cache: Map<string, { value: any; expiry?: number }> = new Map();
  private prefix: string;
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(prefix: string = 'cache') {
    this.prefix = prefix;
  }
  
  /**
   * Get a prefixed key
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
  
  /**
   * Get a value from the distributed cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    const prefixedKey = this.getKey(key);
    const entry = InMemoryDistributedCacheProvider.cache.get(prefixedKey);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }
    
    // Check if the entry has expired
    if (entry.expiry && entry.expiry < Date.now()) {
      InMemoryDistributedCacheProvider.cache.delete(prefixedKey);
      this.misses++;
      return undefined;
    }
    
    this.hits++;
    return entry.value as T;
  }
  
  /**
   * Set a value in the distributed cache
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const prefixedKey = this.getKey(key);
    const entry = {
      value,
      expiry: ttlMs ? Date.now() + ttlMs : undefined
    };
    
    InMemoryDistributedCacheProvider.cache.set(prefixedKey, entry);
  }
  
  /**
   * Delete a value from the distributed cache
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.getKey(key);
    InMemoryDistributedCacheProvider.cache.delete(prefixedKey);
  }
  
  /**
   * Clear all values from the distributed cache with the current prefix
   */
  async clear(): Promise<void> {
    // Delete all keys with the current prefix
    for (const key of InMemoryDistributedCacheProvider.cache.keys()) {
      if (key.startsWith(`${this.prefix}:`)) {
        InMemoryDistributedCacheProvider.cache.delete(key);
      }
    }
  }
  
  /**
   * Check if a key exists in the distributed cache
   */
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.getKey(key);
    const entry = InMemoryDistributedCacheProvider.cache.get(prefixedKey);
    
    if (!entry) {
      return false;
    }
    
    // Check if the entry has expired
    if (entry.expiry && entry.expiry < Date.now()) {
      InMemoryDistributedCacheProvider.cache.delete(prefixedKey);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the number of items in the distributed cache with the current prefix
   */
  async size(): Promise<number> {
    let count = 0;
    
    // Count all keys with the current prefix
    for (const [key, entry] of InMemoryDistributedCacheProvider.cache.entries()) {
      if (key.startsWith(`${this.prefix}:`)) {
        // Check if the entry has expired
        if (entry.expiry && entry.expiry < Date.now()) {
          InMemoryDistributedCacheProvider.cache.delete(key);
        } else {
          count++;
        }
      }
    }
    
    return count;
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? this.hits / total : 0;
    
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio,
      size: await this.size()
    };
  }
}

/**
 * Extended task options with middleware and caching options
 */
export interface CacheableTaskOptions extends ExtendedTaskOptions {
  skipCache?: boolean; // Option to skip cache for this task execution
}

/**
 * Runtime options
 */
export interface RuntimeOptions {
  onProcessCreated?: (instance: ProcessInstance) => void;
  taskMiddleware?: TaskMiddleware;
  storage?: {
    saveState: (instances: ProcessInstance[]) => void;
    loadState: () => ProcessInstance[];
  };
  services?: Record<string, any>;
  plugins?: Plugin[];
  config?: SystemConfig;
  logger?: Logger;
  metrics?: MetricsCollector;
  caching?: {
    enabled: boolean;
    distributed?: {
      enabled: boolean;
      provider?: DistributedCacheProvider;
      instanceId?: string; // Unique ID for this runtime instance
    };
    processCache?: {
      maxSize?: number;
    };
    taskResultCache?: {
      maxSize?: number;
      ttl?: number; // Time to live in milliseconds
    };
  };
}

/**
 * Default system config
 */
const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  id: 'default',
  processes: {},
  tasks: {}
};

/**
 * Error types for the ReactiveRuntime
 */
export enum RuntimeErrorType {
  PROCESS_NOT_FOUND = 'PROCESS_NOT_FOUND',
  PROCESS_DEFINITION_NOT_FOUND = 'PROCESS_DEFINITION_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_EXECUTION_ERROR = 'TASK_EXECUTION_ERROR',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PLUGIN_ERROR = 'PLUGIN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Runtime error class
 */
export class RuntimeError extends Error {
  type: RuntimeErrorType;
  details?: any;
  timestamp: Date;
  
  constructor(type: RuntimeErrorType, message: string, details?: any) {
    super(message);
    this.name = 'RuntimeError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date();
  }
}

/**
 * Transaction state
 */
export enum TransactionState {
  PENDING = 'PENDING',
  COMMITTED = 'COMMITTED',
  ROLLED_BACK = 'ROLLED_BACK'
}

/**
 * Transaction interface
 */
export interface Transaction {
  id: string;
  state: TransactionState;
  operations: Array<{
    type: 'CREATE_PROCESS' | 'TRANSITION_PROCESS' | 'EXECUTE_TASK';
    params: any;
    result?: any;
  }>;
  createdAt: Date;
  updatedAt: Date;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Reactive Runtime implementation
 * 
 * This class implements the Runtime interface using the ProcessManager and TaskManager.
 * It provides a reactive event-driven architecture for process and task execution.
 */
export class ReactiveRuntime implements Runtime {
  private processManager: ProcessManager;
  private taskManager: TaskManager;
  private eventBus: ReactiveEventBus;
  private options: RuntimeOptions;
  private plugins: Plugin[] = [];
  private logger: Logger;
  private metrics: MetricsCollector;
  private activeTransactions: Map<string, Transaction> = new Map();
  
  // Caches for performance optimization
  private processCache: Cache<string, ProcessInstance>;
  private taskResultCache: Cache<string, { result: any; timestamp: number }>;
  private cachingEnabled: boolean;
  private distributedCachingEnabled: boolean;
  private taskResultCacheTTL: number;
  
  /**
   * Create a new ReactiveRuntime
   */
  constructor(
    processes: Record<string, ProcessDefinition>,
    tasks: Record<string, TaskDefinition>,
    options: RuntimeOptions = {}
  ) {
    this.options = options;
    
    // Initialize logger and metrics
    this.logger = options.logger || new ConsoleLogger();
    this.metrics = options.metrics || new NoopMetricsCollector();
    
    // Initialize caching
    this.cachingEnabled = options.caching?.enabled ?? false;
    this.distributedCachingEnabled = options.caching?.distributed?.enabled ?? false;
    this.taskResultCacheTTL = options.caching?.taskResultCache?.ttl || 60000; // Default 1 minute
    
    // Create local caches
    const localProcessCache = new LRUCache<string, ProcessInstance>(
      options.caching?.processCache?.maxSize || 100
    );
    
    const localTaskResultCache = new LRUCache<string, { result: any; timestamp: number }>(
      options.caching?.taskResultCache?.maxSize || 50
    );
    
    // Initialize caches (local or distributed)
    if (this.cachingEnabled && this.distributedCachingEnabled && options.caching?.distributed?.provider) {
      const instanceId = options.caching.distributed.instanceId || `runtime-${uuidv4()}`;
      
      // Create distributed process cache
      this.processCache = new DistributedCache<string, ProcessInstance>(
        localProcessCache,
        options.caching.distributed.provider,
        `${instanceId}:process`,
        undefined,
        this.logger
      );
      
      // Create distributed task result cache
      this.taskResultCache = new DistributedCache<string, { result: any; timestamp: number }>(
        localTaskResultCache,
        options.caching.distributed.provider,
        `${instanceId}:task`,
        this.taskResultCacheTTL,
        this.logger
      );
      
      this.logger.info('Distributed caching enabled', {
        instanceId,
        processMaxSize: options.caching?.processCache?.maxSize || 100,
        taskResultMaxSize: options.caching?.taskResultCache?.maxSize || 50,
        taskResultTTL: this.taskResultCacheTTL
      });
    } else {
      // Use local caches
      this.processCache = localProcessCache;
      this.taskResultCache = localTaskResultCache;
      
      if (this.cachingEnabled) {
        this.logger.info('Local caching enabled', {
          processMaxSize: options.caching?.processCache?.maxSize || 100,
          taskResultMaxSize: options.caching?.taskResultCache?.maxSize || 50,
          taskResultTTL: this.taskResultCacheTTL
        });
      }
    }
    
    // Initialize components
    this.processManager = new ProcessManager(processes);
    this.taskManager = new TaskManager(tasks);
    this.eventBus = new ReactiveEventBus();
    
    this.logger.info('ReactiveRuntime initialized', { 
      processCount: Object.keys(processes).length,
      taskCount: Object.keys(tasks).length,
      cachingEnabled: this.cachingEnabled,
      distributedCachingEnabled: this.distributedCachingEnabled
    });
    
    // Load plugins if provided
    if (options.plugins) {
      this.plugins = options.plugins;
      for (const plugin of this.plugins) {
        if (plugin.initialize) {
          try {
            plugin.initialize(this);
            this.logger.info(`Plugin initialized: ${plugin.id || 'unknown'}`);
          } catch (error) {
            this.logger.error(`Failed to initialize plugin: ${plugin.id || 'unknown'}`, error);
          }
        }
      }
    }
    
    // Load state from storage if provided
    if (options.storage) {
      try {
        const instances = options.storage.loadState();
        this.processManager.loadInstances(instances);
        this.logger.info(`Loaded ${instances.length} process instances from storage`);
      } catch (error) {
        this.logger.error('Failed to load state from storage', error);
      }
    }
    
    // Subscribe to events
    this.setupEventHandlers();
  }
  
  /**
   * Set up event handlers
   */
  private setupEventHandlers() {
    // Subscribe to all events
    this.eventBus.subscribe('*', (event) => {
      // Handle process events
      if (event.source?.startsWith('process:')) {
        const processId = event.source.split(':')[1];
        // Handle process events
      }
      
      // Handle task events that should trigger process transitions
      if (event.source?.startsWith('task:')) {
        // If the event payload contains an orderId, use it to transition the process
        if (event.payload?.orderId) {
          try {
            // Check if the process exists before trying to transition it
            const processInstance = this.processManager.getProcess(event.payload.orderId);
            if (processInstance) {
              // Try to transition the process with the event
              this.processManager.transitionProcess(
                event.payload.orderId,
                event.type,
                event.payload
              );
            }
          } catch (err) {
            // Log the error but don't throw it to avoid breaking the event flow
            const error = err as Error;
            console.error(`Error transitioning process: ${error.message}`);
          }
        }
      }
    });
  }
  
  /**
   * Create a new process instance
   */
  createProcess<TContext = any>(
    processId: string, 
    context: TContext, 
    options: ProcessOptions = {}
  ): ProcessInstance {
    const timer = this.metrics.startTimer('process.create', { processId });
    
    try {
      const instance = this.processManager.createProcess(processId, context as Record<string, any>, options);
      
      // Record metrics
      this.metrics.incrementCounter('process.created', 1, { processId });
      this.metrics.recordGauge('process.active', this.processManager.getAllProcesses().length);
      
      // Log process creation
      this.logger.info(`Process created: ${instance.id} (${processId})`, { 
        instanceId: instance.id,
        processId,
        initialState: instance.state
      });
      
      // Emit process created event
      this.emitEvent({
        type: 'PROCESS_CREATED',
        payload: { instance },
        source: `process:${instance.id}`
      });
      
      // Call onProcessCreated hook if provided
      if (this.options.onProcessCreated) {
        this.options.onProcessCreated(instance);
      }
      
      return instance;
    } catch (error) {
      // Log error
      this.logger.error(`Failed to create process: ${processId}`, error);
      
      // Record error metric
      this.metrics.incrementCounter('process.create.error', 1, { processId });
      
      throw this.createRuntimeError(error, undefined, context);
    } finally {
      // Record timing
      const duration = timer();
      this.metrics.recordHistogram('process.create.duration', duration, { processId });
    }
  }
  
  /**
   * Get a process instance by ID
   */
  getProcess(instanceId: string): ProcessInstance | undefined {
    // Check cache first if caching is enabled
    if (this.cachingEnabled) {
      const cachedProcess = this.processCache.get(instanceId);
      if (cachedProcess) {
        this.metrics.incrementCounter('cache.process.hit');
        return cachedProcess;
      }
      this.metrics.incrementCounter('cache.process.miss');
    }
    
    // Get from process manager
    const instance = this.processManager.getProcess(instanceId);
    
    // Cache the result if found and caching is enabled
    if (instance && this.cachingEnabled) {
      this.processCache.set(instanceId, instance);
    }
    
    return instance;
  }
  
  /**
   * Get a process instance by ID asynchronously
   * This method is useful when using distributed caching
   */
  async getProcessAsync(instanceId: string): Promise<ProcessInstance | undefined> {
    // Check if we're using distributed caching
    if (this.cachingEnabled && this.distributedCachingEnabled && this.processCache instanceof DistributedCache) {
      try {
        // Try to get from distributed cache
        const cachedProcess = await (this.processCache as DistributedCache<string, ProcessInstance>).getAsync(instanceId);
        if (cachedProcess) {
          this.metrics.incrementCounter('cache.process.hit');
          return cachedProcess;
        }
        this.metrics.incrementCounter('cache.process.miss');
      } catch (error) {
        this.logger.warn(`Error getting process from distributed cache: ${error}`);
        // Fall back to synchronous get
        return this.getProcess(instanceId);
      }
    } else {
      // Fall back to synchronous get
      return this.getProcess(instanceId);
    }
    
    const instance = this.processManager.getProcess(instanceId);
    
    // Cache the result if found and caching is enabled
    if (instance && this.cachingEnabled) {
      if (this.distributedCachingEnabled && this.processCache instanceof DistributedCache) {
        try {
          await (this.processCache as DistributedCache<string, ProcessInstance>).setAsync(instanceId, instance);
        } catch (error) {
          this.logger.warn(`Error setting process in distributed cache: ${error}`);
          // Fall back to synchronous set
          this.processCache.set(instanceId, instance);
        }
      } else {
        this.processCache.set(instanceId, instance);
      }
    }
    
    return instance;
  }
  
  /**
   * Get a process instance by ID with error handling
   */
  getProcessOrThrow(instanceId: string): ProcessInstance {
    const instance = this.processManager.getProcess(instanceId);
    if (!instance) {
      throw new RuntimeError(
        RuntimeErrorType.PROCESS_NOT_FOUND,
        `Process instance not found: ${instanceId}`
      );
    }
    return instance;
  }
  
  /**
   * Get all process instances
   */
  getAllProcesses(): ProcessInstance[] {
    return this.processManager.getAllProcesses();
  }
  
  /**
   * Transition a process instance
   */
  transitionProcess(
    instanceId: string, 
    eventType: string, 
    payload?: any
  ): ProcessInstance {
    // Create and emit an event
    this.emitEvent({
      type: eventType,
      payload,
      source: `process:${instanceId}`
    });
    
    // Transition the process using the process manager
    const updatedInstance = this.processManager.transitionProcess(instanceId, eventType, payload);
    
    // Update cache if caching is enabled
    if (this.cachingEnabled) {
      this.processCache.set(instanceId, updatedInstance);
    }
    
    // Return the updated instance
    return updatedInstance;
  }
  
  /**
   * Execute a task
   */
  async executeTask<TInput = any, TOutput = any>(
    taskId: string, 
    input: TInput, 
    options: TaskOptions = {}
  ): Promise<TOutput> {
    const timer = this.metrics.startTimer('task.execute', { taskId });
    
    // Cast to CacheableTaskOptions to access skipCache property
    const cacheableOptions = options as CacheableTaskOptions;
    
    // Check if we can use cached result
    if (this.cachingEnabled && !cacheableOptions.skipCache) {
      const cacheKey = this.generateTaskCacheKey(taskId, input, options);
      
      // Try to get from cache (distributed or local)
      let cachedResult;
      
      if (this.distributedCachingEnabled && this.taskResultCache instanceof DistributedCache) {
        try {
          // Try to get from distributed cache
          cachedResult = await (this.taskResultCache as DistributedCache<string, { result: any; timestamp: number }>)
            .getAsync(cacheKey);
        } catch (error) {
          this.logger.warn(`Error getting task result from distributed cache: ${error}`);
          // Fall back to synchronous get
          cachedResult = this.taskResultCache.get(cacheKey);
        }
      } else {
        // Use synchronous get
        cachedResult = this.taskResultCache.get(cacheKey);
      }
      
      if (cachedResult) {
        const now = Date.now();
        // Check if the cached result is still valid
        if (now - cachedResult.timestamp < this.taskResultCacheTTL) {
          this.metrics.incrementCounter('cache.task.hit');
          this.logger.debug(`Task cache hit: ${taskId}`, { taskId, cacheKey });
          return cachedResult.result;
        } else {
          // Expired cache entry
          if (this.distributedCachingEnabled && this.taskResultCache instanceof DistributedCache) {
            try {
              await (this.taskResultCache as DistributedCache<string, { result: any; timestamp: number }>)
                .deleteAsync(cacheKey);
            } catch (error) {
              this.logger.warn(`Error deleting expired task result from distributed cache: ${error}`);
              // Fall back to synchronous delete
              this.taskResultCache.delete(cacheKey);
            }
          } else {
            this.taskResultCache.delete(cacheKey);
          }
        }
      }
      this.metrics.incrementCounter('cache.task.miss');
    }
    
    // Create task context with event emitter
    const taskContext: Partial<TaskContext> = {
      emitEvent: (type: string, payload?: any) => {
        this.emitEvent({
          type,
          payload,
          source: `task:${taskId}`
        });
      }
    };
    
    // Apply middleware if provided
    const extendedOptions: ExtendedTaskOptions = {
      ...options
    };
    
    if (this.options.taskMiddleware) {
      extendedOptions.middleware = this.options.taskMiddleware;
    }
    
    // Log task execution
    this.logger.debug(`Executing task: ${taskId}`, { 
      taskId, 
      hasInput: !!input,
      options: Object.keys(options)
    });
    
    try {
      // Execute the task
      const result = await this.taskManager.executeTask<TInput, TOutput>(
        taskId, 
        input, 
        taskContext as TaskContext, 
        extendedOptions
      );
      
      // Record success metric
      this.metrics.incrementCounter('task.success', 1, { taskId });
      
      // Log task completion
      this.logger.debug(`Task completed: ${taskId}`, { 
        taskId, 
        hasResult: !!result
      });
      
      // Cache the result if caching is enabled and the task is cacheable
      if (this.cachingEnabled && !cacheableOptions.skipCache) {
        const cacheKey = this.generateTaskCacheKey(taskId, input, options);
        const cacheEntry = { 
          result, 
          timestamp: Date.now() 
        };
        
        if (this.distributedCachingEnabled && this.taskResultCache instanceof DistributedCache) {
          try {
            await (this.taskResultCache as DistributedCache<string, { result: any; timestamp: number }>)
              .setAsync(cacheKey, cacheEntry);
          } catch (error) {
            this.logger.warn(`Error setting task result in distributed cache: ${error}`);
            // Fall back to synchronous set
            this.taskResultCache.set(cacheKey, cacheEntry);
          }
        } else {
          this.taskResultCache.set(cacheKey, cacheEntry);
        }
      }
      
      return result;
    } catch (error) {
      // Enhance error with more context
      const runtimeError = this.createRuntimeError(error, taskId, input);
      
      // Record error metric
      this.metrics.incrementCounter('task.error', 1, { 
        taskId, 
        errorType: runtimeError.type 
      });
      
      // Log task error
      this.logger.error(`Task error: ${taskId}`, { 
        taskId, 
        errorType: runtimeError.type,
        errorMessage: runtimeError.message
      });
      
      // Emit task error event
      this.emitEvent({
        type: 'TASK_ERROR',
        payload: { 
          taskId, 
          input, 
          error: runtimeError 
        },
        source: `task:${taskId}`
      });
      
      throw runtimeError;
    } finally {
      // Record timing
      const duration = timer();
      this.metrics.recordHistogram('task.execute.duration', duration, { taskId });
    }
  }
  
  /**
   * Generate a cache key for task results
   */
  private generateTaskCacheKey(taskId: string, input: any, options: TaskOptions): string {
    // Create a deterministic key based on taskId and input
    const inputStr = JSON.stringify(input);
    const optionsStr = JSON.stringify(options);
    return `${taskId}:${inputStr}:${optionsStr}`;
  }
  
  /**
   * Create a runtime error from any error
   */
  private createRuntimeError(error: any, taskId?: string, input?: any): RuntimeError {
    if (error instanceof RuntimeError) {
      return error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Determine error type based on message or other properties
    let errorType = RuntimeErrorType.UNKNOWN_ERROR;
    
    if (errorMessage.includes('not found')) {
      if (errorMessage.includes('Task')) {
        errorType = RuntimeErrorType.TASK_NOT_FOUND;
      } else if (errorMessage.includes('Process')) {
        errorType = RuntimeErrorType.PROCESS_NOT_FOUND;
      }
    } else if (errorMessage.includes('timeout')) {
      errorType = RuntimeErrorType.TASK_TIMEOUT;
    } else if (errorMessage.includes('transition')) {
      errorType = RuntimeErrorType.INVALID_TRANSITION;
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      errorType = RuntimeErrorType.VALIDATION_ERROR;
    } else if (taskId) {
      errorType = RuntimeErrorType.TASK_EXECUTION_ERROR;
    }
    
    return new RuntimeError(
      errorType,
      errorMessage,
      {
        taskId,
        input,
        originalError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      }
    );
  }
  
  /**
   * Emit an event
   */
  emitEvent<T extends string = string, P = any>(event: Event<T, P>): void {
    this.eventBus.emit(event);
  }
  
  /**
   * Subscribe to events
   */
  subscribe(eventType: string, handler: EventHandler): Subscription {
    return this.eventBus.subscribe(eventType, handler);
  }
  
  /**
   * Alias for subscribe to match Runtime interface
   */
  subscribeToEvent<T extends string = string, P = any>(
    eventType: T | T[] | '*', 
    handler: EventHandler<T, P>
  ): Subscription {
    if (Array.isArray(eventType)) {
      // Create a subscription for each event type
      const subscriptions: Subscription[] = [];
      for (const type of eventType) {
        subscriptions.push(this.eventBus.subscribe(type, handler as EventHandler));
      }
      
      // Return a composite subscription
      return {
        unsubscribe: () => {
          for (const sub of subscriptions) {
            sub.unsubscribe();
          }
        }
      };
    }
    
    return this.eventBus.subscribe(eventType, handler as EventHandler);
  }
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(subscription: Subscription): void {
    subscription.unsubscribe();
  }
  
  /**
   * Get system configuration
   */
  getConfig(): SystemConfig {
    return this.options.config || DEFAULT_SYSTEM_CONFIG;
  }
  
  /**
   * Get a service by name
   */
  getService<T = any>(name: string): T {
    const service = (this.options.services?.[name] as T) || null;
    if (service === null) {
      // For backward compatibility with tests, return null instead of throwing
      return null as unknown as T;
    }
    return service;
  }
  
  /**
   * Register a service
   */
  registerService(name: string, service: any): void {
    if (!this.options.services) {
      this.options.services = {};
    }
    this.options.services[name] = service;
  }
  
  /**
   * Run a test to match Runtime interface
   */
  async runTest(
    test: TestDefinition, 
    options: TestOptions = {}
  ): Promise<TestResult> {
    const startTime = new Date();
    const steps: TestStepResult[] = [];
    let success = true;
    
    try {
      // Execute each step in the test
      for (const step of test.steps) {
        const stepStartTime = Date.now();
        let stepSuccess = true;
        let actual: any = undefined;
        let error: Error | undefined = undefined;
        
        try {
          // Execute the step based on its type
          switch (step.type) {
            case 'create-process':
              const processId = step.params?.processId as string;
              const context = step.params?.context || {};
              const processOptions = step.params?.options || {};
              
              const instance = this.createProcess(processId, context, processOptions);
              actual = instance;
              break;
              
            case 'execute-task':
              const taskId = step.params?.taskId as string;
              const input = step.params?.input || {};
              const taskOptions = step.params?.options || {};
              
              const result = await this.executeTask(taskId, input, taskOptions);
              actual = result;
              break;
              
            case 'emit-event':
              const eventType = step.params?.type as string;
              const payload = step.params?.payload || {};
              const source = step.params?.source;
              
              this.emitEvent({
                type: eventType,
                payload,
                source
              });
              actual = { type: eventType, payload };
              break;
              
            case 'verify-state':
              const instanceId = step.params?.instanceId as string;
              const expectedState = step.params?.state as string;
              
              const processInstance = this.getProcess(instanceId);
              if (!processInstance) {
                throw new Error(`Process instance not found: ${instanceId}`);
              }
              
              actual = processInstance.state;
              if (actual !== expectedState) {
                stepSuccess = false;
              }
              break;
              
            case 'wait':
              const duration = step.params?.duration as number || 100;
              await new Promise(resolve => setTimeout(resolve, duration));
              actual = { waited: duration };
              break;
              
            default:
              throw new Error(`Unknown test step type: ${step.type}`);
          }
        } catch (err) {
          stepSuccess = false;
          error = err as Error;
        }
        
        const stepDuration = Date.now() - stepStartTime;
        
        // Record the step result
        steps.push({
          step,
          success: stepSuccess,
          actual,
          expected: step.expected,
          error,
          duration: stepDuration
        });
        
        // If a step fails, the whole test fails
        if (!stepSuccess) {
          success = false;
          // Check if we should stop on failure
          if (options.stopOnFailure) {
            break;
          }
        }
      }
    } catch (error) {
      success = false;
      console.error(`Error executing test ${test.id}:`, error);
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Return the test result
    return {
      testId: test.id,
      success,
      steps,
      duration,
      startTime,
      endTime,
      metadata: test.metadata
    };
  }
  
  /**
   * Execute a test (alias for runTest)
   */
  async executeTest(
    testId: string, 
    options: TestOptions = {}
  ): Promise<TestResult> {
    // Find the test in the system config
    const config = this.getConfig();
    // Cast to any since tests property might not be defined in SystemConfig
    const tests = (config as any).tests || [];
    const test = tests.find((t: TestDefinition) => t.id === testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    
    return this.runTest(test, options);
  }
  
  /**
   * Run a test suite to match Runtime interface
   */
  async runTestSuite(
    suite: TestSuite, 
    options: TestOptions = {}
  ): Promise<TestSuiteResult> {
    const startTime = new Date();
    const results: TestResult[] = [];
    let success = true;
    
    try {
      // Run beforeAll hook if provided
      if (suite.beforeAll) {
        await suite.beforeAll();
      }
      
      // Execute each test in the suite
      for (const test of suite.tests) {
        // Run beforeEach hook if provided
        if (suite.beforeEach) {
          await suite.beforeEach();
        }
        
        // Run the test
        const testResult = await this.runTest(test, {
          ...options,
          timeout: test.timeout || suite.timeout || options.timeout
        });
        
        results.push(testResult);
        
        // If a test fails, the whole suite fails
        if (!testResult.success) {
          success = false;
          // Check if we should stop on failure
          if (options.stopOnFailure) {
            break;
          }
        }
        
        // Run afterEach hook if provided
        if (suite.afterEach) {
          await suite.afterEach();
        }
      }
      
      // Run afterAll hook if provided
      if (suite.afterAll) {
        await suite.afterAll();
      }
    } catch (error) {
      success = false;
      console.error(`Error executing test suite ${suite.id}:`, error);
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Return the test suite result
    return {
      suiteId: suite.id,
      success,
      results,
      duration,
      startTime,
      endTime,
      metadata: suite.metadata
    };
  }
  
  /**
   * Execute a test suite (alias for runTestSuite)
   */
  async executeTestSuite(
    testSuiteId: string, 
    options: TestOptions = {}
  ): Promise<TestSuiteResult> {
    // Find the test suite in the system config
    const config = this.getConfig();
    // Cast to any since testSuites property might not be defined in SystemConfig
    const testSuites = (config as any).testSuites || [];
    const testSuite = testSuites.find((s: TestSuite) => s.id === testSuiteId);
    if (!testSuite) {
      throw new Error(`Test suite not found: ${testSuiteId}`);
    }
    
    return this.runTestSuite(testSuite, options);
  }
  
  /**
   * Save state to storage
   */
  saveState(): void {
    if (this.options.storage) {
      const instances = this.processManager.getInstancesForSerialization();
      this.options.storage.saveState(instances);
    }
  }
  
  /**
   * Load state from storage
   */
  loadState(): ProcessInstance[] {
    if (this.options.storage) {
      const instances = this.options.storage.loadState();
      this.processManager.loadInstances(instances);
      return instances;
    }
    return [];
  }
  
  /**
   * Export process instances to JSON
   */
  exportProcesses(instanceIds?: string[]): string {
    let instances: ProcessInstance[];
    
    if (instanceIds && instanceIds.length > 0) {
      // Export only specified instances
      instances = instanceIds
        .map(id => this.processManager.getProcess(id))
        .filter((instance): instance is ProcessInstance => !!instance);
    } else {
      // Export all instances
      instances = this.processManager.getAllProcesses();
    }
    
    return JSON.stringify(instances, null, 2);
  }
  
  /**
   * Import process instances from JSON
   */
  importProcesses(json: string): ProcessInstance[] {
    try {
      const instances = JSON.parse(json) as ProcessInstance[];
      this.processManager.loadInstances(instances);
      return instances;
    } catch (error) {
      throw new Error(`Failed to import processes: ${(error as Error).message}`);
    }
  }
  
  /**
   * Create a snapshot of the current state
   */
  createSnapshot(): { 
    processes: ProcessInstance[],
    timestamp: Date,
    version: string
  } {
    return {
      processes: this.processManager.getAllProcesses(),
      timestamp: new Date(),
      version: '1.0.0' // Version of the snapshot format
    };
  }
  
  /**
   * Restore from a snapshot
   */
  restoreSnapshot(snapshot: { 
    processes: ProcessInstance[],
    timestamp: Date,
    version: string
  }): void {
    // Validate snapshot version
    if (snapshot.version !== '1.0.0') {
      throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
    }
    
    // Load instances from snapshot
    this.processManager.loadInstances(snapshot.processes);
  }
  
  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return this.plugins;
  }
  
  /**
   * Get a plugin by ID
   */
  getPlugin<T extends Plugin = Plugin>(id: string): T | null {
    return (this.plugins.find(p => p.id === id) as T) || null;
  }
  
  /**
   * Register a plugin
   */
  registerPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
    if (plugin.initialize) {
      plugin.initialize(this);
    }
  }
  
  /**
   * Start the runtime
   */
  async start(): Promise<void> {
    // Nothing to do for now
  }
  
  /**
   * Stop the runtime
   */
  async stop(): Promise<void> {
    // Nothing to do for now
  }
  
  /**
   * Begin a new transaction
   */
  beginTransaction(): Transaction {
    const transactionId = uuidv4();
    const now = new Date();
    
    // Create a snapshot of the current state for rollback
    const snapshot = this.createSnapshot();
    
    // Create transaction object
    const transaction: Transaction = {
      id: transactionId,
      state: TransactionState.PENDING,
      operations: [],
      createdAt: now,
      updatedAt: now,
      
      // Commit the transaction
      commit: async () => {
        if (transaction.state !== TransactionState.PENDING) {
          throw new RuntimeError(
            RuntimeErrorType.VALIDATION_ERROR,
            `Cannot commit transaction in ${transaction.state} state`
          );
        }
        
        // Mark as committed
        transaction.state = TransactionState.COMMITTED;
        transaction.updatedAt = new Date();
        
        // Remove from active transactions
        this.activeTransactions.delete(transactionId);
        
        // Log and emit event
        this.logger.info(`Transaction committed: ${transactionId}`, {
          transactionId,
          operationCount: transaction.operations.length
        });
        
        this.emitEvent({
          type: 'TRANSACTION_COMMITTED',
          payload: { transactionId, operations: transaction.operations },
          source: `transaction:${transactionId}`
        });
        
        // Record metric
        this.metrics.incrementCounter('transaction.committed', 1);
      },
      
      // Rollback the transaction
      rollback: async () => {
        if (transaction.state !== TransactionState.PENDING) {
          throw new RuntimeError(
            RuntimeErrorType.VALIDATION_ERROR,
            `Cannot rollback transaction in ${transaction.state} state`
          );
        }
        
        // Mark as rolled back
        transaction.state = TransactionState.ROLLED_BACK;
        transaction.updatedAt = new Date();
        
        // Restore from snapshot
        this.restoreSnapshot(snapshot);
        
        // Remove from active transactions
        this.activeTransactions.delete(transactionId);
        
        // Log and emit event
        this.logger.info(`Transaction rolled back: ${transactionId}`, {
          transactionId,
          operationCount: transaction.operations.length
        });
        
        this.emitEvent({
          type: 'TRANSACTION_ROLLED_BACK',
          payload: { transactionId, operations: transaction.operations },
          source: `transaction:${transactionId}`
        });
        
        // Record metric
        this.metrics.incrementCounter('transaction.rolled_back', 1);
      }
    };
    
    // Store in active transactions
    this.activeTransactions.set(transactionId, transaction);
    
    // Log and emit event
    this.logger.info(`Transaction started: ${transactionId}`);
    
    this.emitEvent({
      type: 'TRANSACTION_STARTED',
      payload: { transactionId },
      source: `transaction:${transactionId}`
    });
    
    // Record metric
    this.metrics.incrementCounter('transaction.started', 1);
    
    return transaction;
  }
  
  /**
   * Get a transaction by ID
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.activeTransactions.get(transactionId);
  }
  
  /**
   * Create a process within a transaction
   */
  createProcessInTransaction<TContext = any>(
    transaction: Transaction,
    processId: string,
    context: TContext,
    options: ProcessOptions = {}
  ): ProcessInstance {
    if (transaction.state !== TransactionState.PENDING) {
      throw new RuntimeError(
        RuntimeErrorType.VALIDATION_ERROR,
        `Cannot perform operation in transaction with state: ${transaction.state}`
      );
    }
    
    // Create the process
    const instance = this.createProcess(processId, context, options);
    
    // Record the operation in the transaction
    transaction.operations.push({
      type: 'CREATE_PROCESS',
      params: { processId, context, options },
      result: instance
    });
    
    transaction.updatedAt = new Date();
    
    return instance;
  }
  
  /**
   * Transition a process within a transaction
   */
  transitionProcessInTransaction(
    transaction: Transaction,
    instanceId: string,
    eventType: string,
    payload?: any
  ): ProcessInstance {
    if (transaction.state !== TransactionState.PENDING) {
      throw new RuntimeError(
        RuntimeErrorType.VALIDATION_ERROR,
        `Cannot perform operation in transaction with state: ${transaction.state}`
      );
    }
    
    // Transition the process
    const instance = this.transitionProcess(instanceId, eventType, payload);
    
    // Record the operation in the transaction
    transaction.operations.push({
      type: 'TRANSITION_PROCESS',
      params: { instanceId, eventType, payload },
      result: instance
    });
    
    transaction.updatedAt = new Date();
    
    return instance;
  }
  
  /**
   * Execute a task within a transaction
   */
  async executeTaskInTransaction<TInput = any, TOutput = any>(
    transaction: Transaction,
    taskId: string,
    input: TInput,
    options: TaskOptions = {}
  ): Promise<TOutput> {
    if (transaction.state !== TransactionState.PENDING) {
      throw new RuntimeError(
        RuntimeErrorType.VALIDATION_ERROR,
        `Cannot perform operation in transaction with state: ${transaction.state}`
      );
    }
    
    // Execute the task
    const result = await this.executeTask<TInput, TOutput>(taskId, input, options);
    
    // Record the operation in the transaction
    transaction.operations.push({
      type: 'EXECUTE_TASK',
      params: { taskId, input, options },
      result
    });
    
    transaction.updatedAt = new Date();
    
    return result;
  }
  
  /**
   * Clear all caches
   */
  clearCaches(): void {
    if (!this.cachingEnabled) {
      return;
    }
    
    // Clear local caches
    this.processCache.clear();
    this.taskResultCache.clear();
    
    // Force process manager to reload processes on next access
    this.processManager.clearCache();
    
    this.logger.info('All caches cleared');
    this.metrics.incrementCounter('cache.cleared');
    
    // If distributed caching is enabled, also clear asynchronously
    if (this.distributedCachingEnabled) {
      this.clearCachesAsync().catch(error => {
        this.logger.error('Error clearing distributed caches', error);
      });
    }
  }
  
  /**
   * Clear all caches asynchronously
   * This method is useful when using distributed caching
   */
  async clearCachesAsync(): Promise<void> {
    if (!this.cachingEnabled) {
      return;
    }
    
    this.logger.info('Clearing caches asynchronously');
    
    // Clear process cache
    if (this.distributedCachingEnabled && this.processCache instanceof DistributedCache) {
      try {
        await (this.processCache as DistributedCache<string, ProcessInstance>).clearAsync();
      } catch (error) {
        this.logger.warn(`Error clearing process cache: ${error}`);
        // Fall back to synchronous clear
        this.processCache.clear();
      }
    } else {
      this.processCache.clear();
    }
    
    // Clear task result cache
    if (this.distributedCachingEnabled && this.taskResultCache instanceof DistributedCache) {
      try {
        await (this.taskResultCache as DistributedCache<string, { result: any; timestamp: number }>).clearAsync();
      } catch (error) {
        this.logger.warn(`Error clearing task result cache: ${error}`);
        // Fall back to synchronous clear
        this.taskResultCache.clear();
      }
    } else {
      this.taskResultCache.clear();
    }
    
    this.metrics.incrementCounter('cache.cleared.async');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    if (!this.cachingEnabled) {
      return { enabled: false };
    }
    
    const result: any = {
      enabled: true,
      distributed: this.distributedCachingEnabled,
      processCache: {
        size: this.processCache.size()
      },
      taskResultCache: {
        size: this.taskResultCache.size()
      }
    };
    
    // Add hit/miss stats if available
    if (this.processCache instanceof LRUCache) {
      result.processCache.stats = (this.processCache as LRUCache<string, ProcessInstance>).getStats();
    }
    
    if (this.taskResultCache instanceof LRUCache) {
      result.taskResultCache.stats = (this.taskResultCache as LRUCache<string, { result: any; timestamp: number }>).getStats();
    }
    
    // If distributed caching is enabled, also get async stats
    if (this.distributedCachingEnabled) {
      this.getCacheStatsAsync().then(asyncStats => {
        this.logger.debug('Distributed cache stats', asyncStats);
      }).catch(error => {
        this.logger.error('Error getting distributed cache stats', error);
      });
    }
    
    return result;
  }
  
  /**
   * Get cache statistics asynchronously
   * This method is useful when using distributed caching
   */
  async getCacheStatsAsync(): Promise<any> {
    if (!this.cachingEnabled) {
      return { enabled: false };
    }
    
    const result: any = {
      enabled: true,
      distributed: this.distributedCachingEnabled,
      processCache: {
        size: this.processCache.size()
      },
      taskResultCache: {
        size: this.taskResultCache.size()
      }
    };
    
    // Get distributed cache stats if available
    if (this.distributedCachingEnabled) {
      if (this.processCache instanceof DistributedCache) {
        try {
          const stats = await (this.processCache as DistributedCache<string, ProcessInstance>).getStatsAsync();
          result.processCache.stats = stats.local;
          result.processCache.distributedStats = stats.distributed;
        } catch (error) {
          this.logger.warn(`Error getting process cache stats: ${error}`);
          if (this.processCache instanceof LRUCache) {
            result.processCache.stats = (this.processCache as LRUCache<string, ProcessInstance>).getStats();
          }
        }
      }
      
      if (this.taskResultCache instanceof DistributedCache) {
        try {
          const stats = await (this.taskResultCache as DistributedCache<string, { result: any; timestamp: number }>).getStatsAsync();
          result.taskResultCache.stats = stats.local;
          result.taskResultCache.distributedStats = stats.distributed;
        } catch (error) {
          this.logger.warn(`Error getting task result cache stats: ${error}`);
          if (this.taskResultCache instanceof LRUCache) {
            result.taskResultCache.stats = (this.taskResultCache as LRUCache<string, { result: any; timestamp: number }>).getStats();
          }
        }
      }
    } else {
      // Add hit/miss stats if available
      if (this.processCache instanceof LRUCache) {
        result.processCache.stats = (this.processCache as LRUCache<string, ProcessInstance>).getStats();
      }
      
      if (this.taskResultCache instanceof LRUCache) {
        result.taskResultCache.stats = (this.taskResultCache as LRUCache<string, { result: any; timestamp: number }>).getStats();
      }
    }
    
    return result;
  }
} 