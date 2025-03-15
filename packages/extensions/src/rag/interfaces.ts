/**
 * RAG interfaces
 */
import {
  ProcessDefinition,
  TaskDefinition,
  SystemConfig,
  TestDefinition
} from '../types/index';

/**
 * Code processor
 */
export interface CodeProcessor {
  processCode(code: string): any;
}

/**
 * Code converter
 */
export interface CodeConverter<T> {
  convert(code: string): T;
}

/**
 * Fallback creator
 */
export interface FallbackCreator<T> {
  create(name: string, description?: string): T;
}
