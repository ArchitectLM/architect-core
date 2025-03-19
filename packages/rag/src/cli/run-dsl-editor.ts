/**
 * @file CLI script to run the DSL editor with ChromaDB
 * @module @architectlm/rag
 */

import { LLMService, LLMServiceConfig } from '../llm/llm-service.js';
import { CodeValidator } from '../validation/code-validator.js';
import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
import { 
  ComponentType,
  Component as DslComponent,
  SchemaComponent,
  CommandComponent,
  QueryComponent,
  EventComponent,
  WorkflowComponent,
  ExtensionComponent,
  PluginComponent
} from '@architectlm/dsl';
import { VectorDBConfig, Component as RagComponent } from '../models.js';

/**
 * Map RAG component to DSL component
 */
function mapToDslComponent(ragComponent: RagComponent): DslComponent {
  const type = ragComponent.type;
  
  // Create base component properties
  const baseProps = {
    type,
    name: ragComponent.name,
    description: ragComponent.metadata.description,
    version: ragComponent.metadata.version,
    tags: ragComponent.metadata.tags,
    authors: ragComponent.metadata.author ? [ragComponent.metadata.author] : undefined,
    path: ragComponent.metadata.path,
  };

  // Create type-specific component
  switch (type) {
    case ComponentType.SCHEMA:
      return {
        ...baseProps,
        type: ComponentType.SCHEMA,
        definition: {
          type: 'object',
          properties: {},
          required: [],
        },
      } as SchemaComponent;

    case ComponentType.COMMAND:
      return {
        ...baseProps,
        type: ComponentType.COMMAND,
        input: { ref: '', required: true },
        output: { ref: '', required: true },
        definition: {},
      } as CommandComponent;

    case ComponentType.QUERY:
      return {
        ...baseProps,
        type: ComponentType.QUERY,
        input: { ref: '', required: true },
        output: { ref: '', required: true },
        definition: {},
      } as QueryComponent;

    case ComponentType.EVENT:
      return {
        ...baseProps,
        type: ComponentType.EVENT,
        payload: { ref: '', required: true },
        definition: {},
      } as EventComponent;

    case ComponentType.WORKFLOW:
      return {
        ...baseProps,
        type: ComponentType.WORKFLOW,
        steps: [],
        definition: {},
      } as WorkflowComponent;

    case ComponentType.EXTENSION:
      return {
        ...baseProps,
        type: ComponentType.EXTENSION,
        hooks: {},
        definition: {},
      } as ExtensionComponent;

    case ComponentType.PLUGIN:
      return {
        ...baseProps,
        type: ComponentType.PLUGIN,
        operations: [
          {
            name: 'default',
            description: 'Default operation',
            input: { ref: '', required: true },
            output: { ref: '', required: true },
          },
        ],
        definition: {},
      } as PluginComponent;

    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

async function saveComponent(component: RagComponent, vectorDB: ChromaDBConnector): Promise<RagComponent> {
  console.log('\n=== Saving Component ===');
  console.log('Component to save:', {
    id: component.id,
    type: component.type,
    name: component.name,
    contentLength: component.content.length
  });

  // Normalize tags to array format if they're in string format
  if (component.metadata && typeof component.metadata.tags === 'string') {
    component.metadata.tags = (component.metadata.tags as string).split(',');
  }

  // Initialize the vector DB if not already initialized
  await vectorDB.initialize();
  
  // Save the component and get its ID
  const id = await vectorDB.addDocument(component);
  console.log('Component saved with ID:', id);
  
  // Verify the component was saved by retrieving it
  const savedComponent = await vectorDB.getDocument(id);
  console.log('Retrieved saved component:', savedComponent ? {
    id: savedComponent.id,
    type: savedComponent.type,
    name: savedComponent.name,
    contentLength: savedComponent.content.length
  } : 'null');

  if (!savedComponent) {
    throw new Error('Failed to verify saved component');
  }
  
  return savedComponent;
}

/**
 * Validate a component against DSL rules
 */
async function validateComponent(ragComponent: RagComponent): Promise<boolean> {
  try {
    // Map to DSL component
    const dslComponent = mapToDslComponent(ragComponent);
    if (!dslComponent) {
      console.error("Failed to map component to DSL format");
      return false;
    }

    // Validate the component
    const codeValidator = new CodeValidator();
    const validationResult = await codeValidator.validateCode(ragComponent.content, {
      query: "",
      relevantComponents: [],
      suggestedChanges: [],
      globalContext: ""
    });

    if (!validationResult.isValid) {
      console.error("Component validation failed:", validationResult.errors);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating component:", error);
    return false;
  }
}

/**
 * Run the DSL editor
 */
export async function runDslEditor(
  query: string,
  vectorDB?: ChromaDBConnector,
  debug = false
): Promise<any> {
  // Handle empty query
  if (!query || query.trim() === '') {
    return {
      success: false,
      error: 'No command provided'
    };
  }

  const defaultConfig: VectorDBConfig = {
    collectionName: 'main-component',
    embeddingDimension: 1536,
    distance: 'cosine',
  };

  if (!vectorDB) {
    vectorDB = new ChromaDBConnector(defaultConfig);
  }

  const llmConfig: LLMServiceConfig = {
    model: 'gpt-4',
    temperature: 0.7,
    vectorDB,
  };

  const llmService = new LLMService(llmConfig);

  try {
    console.log('Initializing RAG DSL Editor...');
    // Get initial database statistics with more detailed logging
    console.log('\n=== Querying All Documents ===');
    const allComponents = await vectorDB.search('', { 
      limit: 1000, // Increased limit to get all documents
      threshold: 0.0, // No threshold to get everything
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    console.log('\n=== All Documents in Database ===');
    console.log(JSON.stringify(allComponents.map(c => ({
      id: c.component.id,
      type: c.component.type,
      name: c.component.name,
      metadata: c.component.metadata,
      contentPreview: c.component.content.substring(0, 100) + '...',
      score: c.score,
      distance: c.distance
    })), null, 2));

    // Format context for LLM using all components
    const formattedContext = allComponents
      .map((r: { component: { name: string; content: string } }) => `// ${r.component.name}\n${r.component.content}`)
      .join('\n\n');

    // Simple component type detection
    const determineComponentType = (query: string): ComponentType => {
      const lowercaseQuery = query.toLowerCase();
      if (lowercaseQuery.includes('schema')) return ComponentType.SCHEMA;
      if (lowercaseQuery.includes('command')) return ComponentType.COMMAND;
      if (lowercaseQuery.includes('workflow')) return ComponentType.WORKFLOW;
      if (lowercaseQuery.includes('plugin')) return ComponentType.PLUGIN;
      if (lowercaseQuery.includes('event')) return ComponentType.EVENT;
      if (lowercaseQuery.includes('query')) return ComponentType.QUERY;
      if (lowercaseQuery.includes('extension')) return ComponentType.EXTENSION;
      return ComponentType.COMMAND; // Default to command
    };

    // Generate component using LLM with all available context
    let generatedComponent: RagComponent | undefined;
    try {
      generatedComponent = await llmService.generateComponent(query, determineComponentType(query), formattedContext);
      if (!generatedComponent) {
        return {
          success: false,
          error: 'Failed to generate component'
        };
      }

      // Validate the generated component
      const isValid = await validateComponent(generatedComponent);
      if (!isValid) {
        return {
          success: false,
          error: 'Generated component failed validation'
        };
      }

      // Map to DSL component
      const dslComponent = mapToDslComponent(generatedComponent);
      if (!dslComponent) {
        return {
          success: false,
          error: 'Failed to map component to DSL format'
        };
      }

      // Save the component if vectorDB is provided
      if (vectorDB) {
        const savedComponent = await saveComponent(generatedComponent, vectorDB);
        if (!savedComponent) {
          return {
            success: false,
            error: 'Failed to save component to database'
          };
        }

        // Search for the newly created component to verify it was saved
        const newComponents = await vectorDB.search(generatedComponent.name, {
          limit: 10,
          threshold: 0.0,
          includeMetadata: true,
          includeEmbeddings: false,
          orderBy: 'relevance',
          orderDirection: 'desc',
          types: [determineComponentType(query)]
        });

        return {
          success: true,
          component: generatedComponent,
          newComponents
        };
      }

      return {
        success: true,
        component: generatedComponent
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  } catch (error) {
    console.error('Error running DSL editor:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the DSL editor if called directly
if (require.main === module) {
  runDslEditor(process.argv.slice(2).join(' ')).catch(console.error);
} 