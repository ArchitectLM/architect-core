import { describe, it, expect } from 'vitest';

// Define interfaces and mock classes for testing
interface PromptFragment {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

interface ComposedPrompt {
  fragments: PromptFragment[];
  variables: Record<string, any>;
}

class PromptComposer {
  private fragments: Map<string, PromptFragment> = new Map();

  registerFragment(fragment: PromptFragment): void {
    this.fragments.set(fragment.id, fragment);
  }

  getFragment(id: string): PromptFragment | undefined {
    return this.fragments.get(id);
  }

  compose(fragmentIds: string[], variables: Record<string, any> = {}): ComposedPrompt {
    const fragments: PromptFragment[] = [];
    
    for (const id of fragmentIds) {
      const fragment = this.fragments.get(id);
      if (!fragment) {
        throw new Error(`Fragment not found: ${id}`);
      }
      fragments.push(fragment);
    }
    
    return {
      fragments,
      variables
    };
  }

  render(composed: ComposedPrompt): string {
    let result = '';
    
    for (const fragment of composed.fragments) {
      let content = fragment.content;
      
      // Replace variables in the content
      for (const [key, value] of Object.entries(composed.variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, String(value));
      }
      
      result += content + '\n';
    }
    
    return result.trim();
  }

  optimize(composed: ComposedPrompt, options: { maxLength?: number, prioritize?: string[] } = {}): ComposedPrompt {
    const { maxLength, prioritize = [] } = options;
    
    if (!maxLength) {
      return composed;
    }
    
    // Create a copy of fragments to work with
    let optimizedFragments = [...composed.fragments];
    
    // Calculate current length
    const currentLength = this.calculateTotalLength(optimizedFragments);
    
    if (currentLength <= maxLength) {
      return composed;
    }
    
    // Sort fragments by priority (prioritized fragments come last so they're removed last)
    optimizedFragments.sort((a, b) => {
      const aPriority = prioritize.indexOf(a.id);
      const bPriority = prioritize.indexOf(b.id);
      
      if (aPriority === -1 && bPriority === -1) return 0;
      if (aPriority === -1) return -1;
      if (bPriority === -1) return 1;
      
      return aPriority - bPriority;
    });
    
    // Remove fragments until we're under the max length
    while (this.calculateTotalLength(optimizedFragments) > maxLength && optimizedFragments.length > 0) {
      optimizedFragments.shift();
    }
    
    return {
      fragments: optimizedFragments,
      variables: composed.variables
    };
  }

  private calculateTotalLength(fragments: PromptFragment[]): number {
    return fragments.reduce((total, fragment) => total + fragment.content.length, 0);
  }
}

describe('Prompt Composition System', () => {
  describe('Fragment Management', () => {
    it('should register and retrieve prompt fragments', () => {
      const composer = new PromptComposer();
      
      const fragment: PromptFragment = {
        id: 'greeting',
        content: 'Hello, {{name}}!'
      };
      
      composer.registerFragment(fragment);
      
      const retrievedFragment = composer.getFragment('greeting');
      expect(retrievedFragment).toBeDefined();
      expect(retrievedFragment?.id).toBe('greeting');
      expect(retrievedFragment?.content).toBe('Hello, {{name}}!');
    });
  });
  
  describe('Prompt Composition', () => {
    it('should compose prompts from fragments', () => {
      const composer = new PromptComposer();
      
      composer.registerFragment({
        id: 'greeting',
        content: 'Hello, {{name}}!'
      });
      
      composer.registerFragment({
        id: 'question',
        content: 'How are you today?'
      });
      
      const composed = composer.compose(['greeting', 'question'], { name: 'John' });
      
      expect(composed.fragments.length).toBe(2);
      expect(composed.fragments[0].id).toBe('greeting');
      expect(composed.fragments[1].id).toBe('question');
      expect(composed.variables.name).toBe('John');
    });
    
    it('should throw an error when composing with non-existent fragments', () => {
      const composer = new PromptComposer();
      
      composer.registerFragment({
        id: 'greeting',
        content: 'Hello, {{name}}!'
      });
      
      expect(() => {
        composer.compose(['greeting', 'non-existent']);
      }).toThrow(/Fragment not found/);
    });
  });
  
  describe('Prompt Rendering', () => {
    it('should render composed prompts with variables', () => {
      const composer = new PromptComposer();
      
      composer.registerFragment({
        id: 'greeting',
        content: 'Hello, {{name}}!'
      });
      
      composer.registerFragment({
        id: 'question',
        content: 'How is your {{topic}} project going?'
      });
      
      const composed = composer.compose(
        ['greeting', 'question'], 
        { name: 'John', topic: 'AI' }
      );
      
      const rendered = composer.render(composed);
      
      expect(rendered).toBe('Hello, John!\nHow is your AI project going?');
    });
  });
  
  describe('Prompt Optimization', () => {
    it('should optimize prompts to fit within a maximum length', () => {
      const composer = new PromptComposer();
      
      composer.registerFragment({
        id: 'greeting',
        content: 'Hello, {{name}}!'
      });
      
      composer.registerFragment({
        id: 'question',
        content: 'How is your {{topic}} project going?'
      });
      
      composer.registerFragment({
        id: 'context',
        content: 'I remember you were working on {{details}}.'
      });
      
      const composed = composer.compose(
        ['greeting', 'question', 'context'], 
        { name: 'John', topic: 'AI', details: 'a machine learning model for natural language processing' }
      );
      
      // Set max length to only allow one fragment
      const optimized = composer.optimize(composed, { maxLength: 50 });
      
      expect(optimized.fragments.length).toBe(1);
      expect(optimized.fragments[0].id).toBe('context');
    });
    
    it('should respect priority when optimizing prompts', () => {
      const composer = new PromptComposer();
      
      composer.registerFragment({
        id: 'greeting',
        content: 'Hello, {{name}}!'
      });
      
      composer.registerFragment({
        id: 'question',
        content: 'How is your {{topic}} project going?'
      });
      
      composer.registerFragment({
        id: 'context',
        content: 'I remember you were working on {{details}}.'
      });
      
      const composed = composer.compose(
        ['greeting', 'question', 'context'], 
        { name: 'John', topic: 'AI', details: 'a machine learning model for natural language processing' }
      );
      
      // Set max length to only allow one fragment, but prioritize greeting
      const optimized = composer.optimize(composed, { 
        maxLength: 50,
        prioritize: ['greeting'] 
      });
      
      expect(optimized.fragments.length).toBe(1);
      expect(optimized.fragments[0].id).toBe('greeting');
    });
  });
  
  describe('Advanced Composition Features', () => {
    it('should support conditional fragments', () => {
      const composer = new PromptComposer();
      
      composer.registerFragment({
        id: 'greeting',
        content: 'Hello, {{name}}!'
      });
      
      composer.registerFragment({
        id: 'returning-user',
        content: 'Welcome back! Your last visit was on {{lastVisit}}.'
      });
      
      composer.registerFragment({
        id: 'new-user',
        content: 'Welcome to our platform! Let me show you around.'
      });
      
      // Function to conditionally compose based on user status
      const composeUserPrompt = (user: { name: string, isReturning: boolean, lastVisit?: string }) => {
        const fragmentIds = ['greeting'];
        
        if (user.isReturning && user.lastVisit) {
          fragmentIds.push('returning-user');
        } else {
          fragmentIds.push('new-user');
        }
        
        return composer.compose(fragmentIds, user);
      };
      
      // Test with returning user
      const returningUser = {
        name: 'John',
        isReturning: true,
        lastVisit: '2023-05-15'
      };
      
      const returningUserPrompt = composeUserPrompt(returningUser);
      const renderedReturningUser = composer.render(returningUserPrompt);
      
      expect(renderedReturningUser).toContain('Welcome back!');
      expect(renderedReturningUser).toContain('2023-05-15');
      
      // Test with new user
      const newUser = {
        name: 'Alice',
        isReturning: false
      };
      
      const newUserPrompt = composeUserPrompt(newUser);
      const renderedNewUser = composer.render(newUserPrompt);
      
      expect(renderedNewUser).toContain('Welcome to our platform!');
      expect(renderedNewUser).not.toContain('Welcome back!');
    });
  });
}); 