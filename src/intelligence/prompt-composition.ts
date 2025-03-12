/**
 * Prompt Composition System
 * 
 * This module provides functionality for composing prompts from fragments
 * and optimizing them for specific use cases.
 */

/**
 * Position of a prompt fragment in the composed prompt
 */
export type FragmentPosition = 'header' | 'context' | 'instruction' | 'example' | 'footer';

/**
 * Condition function for conditional fragments
 */
export type FragmentCondition = (context: any) => boolean;

/**
 * Prompt fragment definition
 */
export interface PromptFragment {
  id: string;
  content: string;
  position: FragmentPosition;
  priority: number;
  condition?: FragmentCondition;
  metadata?: Record<string, any>;
}

/**
 * Composed prompt result
 */
export interface ComposedPrompt {
  content: string;
  fragments: PromptFragment[];
  estimatedTokens: number;
  metadata: {
    composedAt: string;
    totalFragments: number;
    appliedFragments: number;
  };
}

/**
 * Prompt composer for building prompts from fragments
 */
export class PromptComposer {
  private fragments: PromptFragment[] = [];
  
  /**
   * Add a fragment to the composer
   */
  addFragment(fragment: PromptFragment): void {
    this.fragments.push(fragment);
  }
  
  /**
   * Add multiple fragments to the composer
   */
  addFragments(fragments: PromptFragment[]): void {
    this.fragments.push(...fragments);
  }
  
  /**
   * Remove a fragment by ID
   */
  removeFragment(id: string): boolean {
    const initialLength = this.fragments.length;
    this.fragments = this.fragments.filter(fragment => fragment.id !== id);
    return this.fragments.length !== initialLength;
  }
  
  /**
   * Get all fragments
   */
  getFragments(): PromptFragment[] {
    return [...this.fragments];
  }
  
  /**
   * Compose a prompt from fragments based on context
   */
  composePrompt(context: any = {}): ComposedPrompt {
    // Filter fragments based on conditions
    const applicableFragments = this.fragments.filter(fragment => 
      !fragment.condition || fragment.condition(context)
    );
    
    // Sort by position and priority
    const sortedFragments = [...applicableFragments].sort((a, b) => {
      const positionOrder: Record<FragmentPosition, number> = {
        header: 0,
        context: 1,
        instruction: 2,
        example: 3,
        footer: 4
      };
      
      if (positionOrder[a.position] !== positionOrder[b.position]) {
        return positionOrder[a.position] - positionOrder[b.position];
      }
      
      return a.priority - b.priority;
    });
    
    // Compose the prompt
    const content = sortedFragments.map(fragment => fragment.content).join('\n\n');
    
    // Estimate token count (very rough estimate: ~4 chars per token)
    const estimatedTokens = Math.ceil(content.length / 4);
    
    return {
      content,
      fragments: sortedFragments,
      estimatedTokens,
      metadata: {
        composedAt: new Date().toISOString(),
        totalFragments: this.fragments.length,
        appliedFragments: sortedFragments.length
      }
    };
  }
  
  /**
   * Optimize a prompt to fit within a token limit
   */
  optimizePrompt(composedPrompt: ComposedPrompt, maxTokens: number): ComposedPrompt {
    if (composedPrompt.estimatedTokens <= maxTokens) {
      return composedPrompt; // No optimization needed
    }
    
    // Calculate how much we need to reduce
    const reductionFactor = maxTokens / composedPrompt.estimatedTokens;
    
    // Start with all fragments
    let optimizedFragments = [...composedPrompt.fragments];
    
    // If we need significant reduction, start removing lower priority fragments
    if (reductionFactor < 0.8) {
      // Group fragments by position
      const fragmentsByPosition: Record<FragmentPosition, PromptFragment[]> = {
        header: [],
        context: [],
        instruction: [],
        example: [],
        footer: []
      };
      
      composedPrompt.fragments.forEach(fragment => {
        fragmentsByPosition[fragment.position].push(fragment);
      });
      
      // Strategy: Keep all instructions, reduce examples, then context, then footer
      // Sort examples by priority and keep only the top ones
      if (fragmentsByPosition.example.length > 1) {
        const sortedExamples = fragmentsByPosition.example.sort((a, b) => a.priority - b.priority);
        const keepCount = Math.max(1, Math.floor(sortedExamples.length * reductionFactor));
        fragmentsByPosition.example = sortedExamples.slice(0, keepCount);
      }
      
      // If still too large, reduce context
      let currentEstimate = this.estimateTokens([
        ...fragmentsByPosition.header,
        ...fragmentsByPosition.context,
        ...fragmentsByPosition.instruction,
        ...fragmentsByPosition.example,
        ...fragmentsByPosition.footer
      ]);
      
      if (currentEstimate > maxTokens && fragmentsByPosition.context.length > 1) {
        const sortedContext = fragmentsByPosition.context.sort((a, b) => a.priority - b.priority);
        const keepCount = Math.max(1, Math.floor(sortedContext.length * reductionFactor));
        fragmentsByPosition.context = sortedContext.slice(0, keepCount);
      }
      
      // If still too large, remove footer
      currentEstimate = this.estimateTokens([
        ...fragmentsByPosition.header,
        ...fragmentsByPosition.context,
        ...fragmentsByPosition.instruction,
        ...fragmentsByPosition.example,
        ...fragmentsByPosition.footer
      ]);
      
      if (currentEstimate > maxTokens) {
        fragmentsByPosition.footer = [];
      }
      
      // Combine remaining fragments
      optimizedFragments = [
        ...fragmentsByPosition.header,
        ...fragmentsByPosition.context,
        ...fragmentsByPosition.instruction,
        ...fragmentsByPosition.example,
        ...fragmentsByPosition.footer
      ];
    }
    
    // Compose the optimized prompt
    const content = optimizedFragments.map(fragment => fragment.content).join('\n\n');
    const estimatedTokens = Math.ceil(content.length / 4);
    
    return {
      content,
      fragments: optimizedFragments,
      estimatedTokens,
      metadata: {
        composedAt: new Date().toISOString(),
        totalFragments: composedPrompt.fragments.length,
        appliedFragments: optimizedFragments.length
      }
    };
  }
  
  /**
   * Estimate tokens for a set of fragments
   */
  private estimateTokens(fragments: PromptFragment[]): number {
    const content = fragments.map(fragment => fragment.content).join('\n\n');
    return Math.ceil(content.length / 4);
  }
}

/**
 * Common prompt fragments for reactive systems
 */
export const commonPromptFragments: PromptFragment[] = [
  {
    id: 'system-role-architect',
    content: 'You are an expert system architect specializing in designing reactive systems.',
    position: 'header',
    priority: 0
  },
  {
    id: 'system-role-developer',
    content: 'You are an expert software developer specializing in implementing reactive systems.',
    position: 'header',
    priority: 0
  },
  {
    id: 'schema-context',
    content: `
A ReactiveSystem consists of:
- Bounded contexts: Domain-specific areas of the system
- Processes: Workflows that handle specific business operations
- Tasks: Individual operations that can be composed into processes
- Flows: Sequences of processes and tasks that form end-to-end workflows
    `,
    position: 'context',
    priority: 10
  },
  {
    id: 'process-example',
    content: `
Example process:
{
  "id": "order-processing",
  "name": "Order Processing",
  "type": "stateful",
  "states": ["pending", "validated", "payment-processing", "fulfilled", "cancelled"],
  "transitions": [
    { "from": "pending", "to": "validated", "on": "validate" },
    { "from": "validated", "to": "payment-processing", "on": "process-payment" },
    { "from": "payment-processing", "to": "fulfilled", "on": "payment-success" },
    { "from": "payment-processing", "to": "cancelled", "on": "payment-failure" }
  ],
  "tasks": ["validate-order", "process-payment", "update-inventory", "send-confirmation"]
}
    `,
    position: 'example',
    priority: 20
  },
  {
    id: 'json-format-instruction',
    content: 'Provide your response in valid JSON format.',
    position: 'footer',
    priority: 0
  }
];

/**
 * Create and initialize a prompt composer with common fragments
 */
export function createPromptComposer(): PromptComposer {
  const composer = new PromptComposer();
  
  // Add common fragments
  composer.addFragments(commonPromptFragments);
  
  return composer;
} 