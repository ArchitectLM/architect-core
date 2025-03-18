/**
 * @file CLI script to run the DSL editor with ChromaDB
 * @module @architectlm/rag
 */

// import { CliTool } from './cli-tool.js';
import { LLMService, LLMServiceConfig } from '../llm/llm-service.js';
import { CodeValidator } from '../validation/code-validator.js';
import { CliCommandHandler } from './cli-command-handler.js';
// import { SessionManager } from './session-manager.js';
// import { VectorConfigStore } from './vector-config-store.js';
// import { ErrorFormatter } from './error-formatter.js';
import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
// import { ComponentSearch } from '../search/component-search.js';
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
import { VectorDBConfig, Component as RagComponent, VectorDBConnector, SearchResult } from '../models.js';

// Debug interface
// interface DebugInfo {
//   dbStats: {
//     totalComponents: number;
//     componentTypes: Record<string, number>;
//     lastUpdated: Date;
//   };
//   queryInfo: {
//     userQuery: string;
//     receivedData: any;
//     promptSent: string;
//     llmResponse: string;
//     validationStatus: {
//       isValid: boolean;
//     };
//     dbStoreStatus: {
//       success: boolean;
//     };
//     finalStats: {
//       processingTime: number;
//       componentsCreated: number;
//     };
//   };
//   generatedComponent?: DslComponent;
//   savedComponent?: DslComponent;
//   context?: any;
// }

// Default configuration for ChromaDB
// const defaultConfig = {
//   collectionName: 'main-component',
//   embeddingDimension: 384,
//   distance: 'cosine' as const
// };

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
  // const configStore = new VectorConfigStore(vectorDB);
  // const componentSearch = new ComponentSearch(vectorDB);

  try {
    console.log('Initializing RAG DSL Editor...');
    
    // Initialize services
    const codeValidator = new CodeValidator();
    const commandHandler = new CliCommandHandler(llmService, codeValidator);
    // const sessionManager = new SessionManager(commandHandler);
    // const errorFormatter = new ErrorFormatter();
    
    // Initialize CLI tool
    // const cliTool = new CliTool(
    //   llmService,
    //   codeValidator,
    //   sessionManager,
    //   configStore,
    //   errorFormatter,
    //   componentSearch
    // );
    
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

    // Get filtered components for specific types
    const components = await vectorDB.search('', { 
      limit: 100, 
      threshold: 0.0,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc',
      types: ['schema', 'command', 'plugin', 'event', 'query', 'workflow', 'extension']
    });

    console.log('\n=== Database Query Parameters ===');
    console.log('Query:', query);
    console.log('Types:', ['schema', 'command', 'plugin', 'event', 'query', 'workflow', 'extension']);

    // Update schema detection patterns
    const schemaPatterns = [
      /create (?:an?|the) schema component/i,
      /define (?:an?|the) schema component/i,
      /new schema component/i,
      /add (?:an?|the) schema component/i,
      /generate (?:an?|the) schema component/i,
      /schema component (?:for|of|with)/i,
      /create (?:an?|the) schema/i,
      /define (?:an?|the) schema/i,
      /new schema/i,
      /add (?:an?|the) schema/i,
      /generate (?:an?|the) schema/i,
      /schema (?:for|of|with)/i,
      /data model/i,
      /data structure/i,
      /entity/i,
      /with fields/i,
      /with attributes/i,
      /with (?:name|email|age|id|date|time|number|string|boolean|array|object)(?:\s|,)/i
    ];

    // Update schema keywords
    const schemaKeywords = [
      'schema component',
      'schema',
      'data structure',
      'data model',
      'entity',
      'definition',
      'structure',
      'fields',
      'attributes',
      'field',
      'attribute',
      'name',
      'email',
      'age',
      'id',
      'date',
      'time',
      'number',
      'string',
      'boolean',
      'array',
      'object',
      'profile'
    ];

    // Update component type detection
    const determineComponentType = (query: string): ComponentType => {
      const lowercaseQuery = query.toLowerCase();

      // Check for schema component first
      if (lowercaseQuery.includes('schema component')) {
        return ComponentType.SCHEMA;
      }

      // Check for schema patterns
      for (const pattern of schemaPatterns) {
        if (pattern.test(query)) {
          return ComponentType.SCHEMA;
        }
      }

      // Check for schema keywords
      const matchedKeywords = schemaKeywords.filter(keyword => 
        lowercaseQuery.includes(keyword.toLowerCase())
      );

      // If we have multiple schema keywords or if it contains "schema component", it's a schema
      if (matchedKeywords.length >= 2 || lowercaseQuery.includes('schema component')) {
        return ComponentType.SCHEMA;
      }

      // Check for field-like patterns that indicate a schema
      const fieldPattern = /(?:name|email|age|id|date|time|number|string|boolean|array|object)(?:\s|,)/i;
      if (fieldPattern.test(query) && lowercaseQuery.includes('schema')) {
        return ComponentType.SCHEMA;
      }

      // Check for explicit component type pattern
      const componentTypePattern = /create (?:an?|the) (\w+) component/i;
      const match = query.match(componentTypePattern);
      if (match) {
        const componentType = match[1].toLowerCase();
        // If it's a schema component, return SCHEMA
        if (componentType === 'schema') {
          return ComponentType.SCHEMA;
        }
        // Otherwise check other component types
        switch (componentType) {
          case 'command':
            return ComponentType.COMMAND;
          case 'workflow':
            return ComponentType.WORKFLOW;
          case 'plugin':
            return ComponentType.PLUGIN;
          case 'event':
            return ComponentType.EVENT;
          case 'query':
            return ComponentType.QUERY;
          case 'extension':
            return ComponentType.EXTENSION;
          default:
            break;
        }
      }

      // Default to command if no specific type is detected
      return ComponentType.COMMAND;
    };

    // Update search functionality
    const searchComponents = async (vectorDB: VectorDBConnector, query: string, componentType: ComponentType): Promise<SearchResult[]> => {
      const searchOptions = {
        limit: 50,  // Increased limit
        threshold: -0.5,  // Much more permissive threshold
        includeMetadata: true,
        includeEmbeddings: false,
        orderBy: 'relevance' as const,
        orderDirection: 'desc' as const
      };

      // Add logging to diagnose the issue
      console.log(`\n=== Searching for components with type: ${componentType} ===`);
      
      // First try type-specific search
      const typeResults = await vectorDB.search(query, {
        ...searchOptions,
        types: [componentType]
      });
      
      // If no results, fallback to a broader search
      if (typeResults.length === 0) {
        console.log('No type-specific results, trying broader search...');
        const allComponents = await vectorDB.search('', {  // Empty query to get all documents
          ...searchOptions,
          types: [componentType]  // Still filter by component type
        });
        
        // Filter components by type manually
        const filteredResults = allComponents.filter(
          result => result.component.type === componentType
        );
        
        console.log(`Found ${filteredResults.length} components after manual filtering`);
        return filteredResults;
      }
      
      return typeResults;
    };

    // Get relevant context from the vector DB
    const context = await searchComponents(vectorDB, query, determineComponentType(query))
      .then(results => results.map(result => result.component.content).join('\n\n'));
    console.log('\nContext being passed to LLM:');
    console.log('------------------');
    console.log(context);
    console.log('------------------\n');

    // Continue with component generation even if no context is found
    // Gather additional context
    const searchOptionsAdditional = {
      limit: 100, // Increased from 10 to 100 for better coverage
      threshold: 0.0, // Reduced from 0.3 to 0.0 for more inclusive results
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance' as const,
      orderDirection: 'desc' as const,
      types: [
        determineComponentType(query), // Primary type based on query
        'plugin', // For documentation
        'extension', // For system extensions
      ]
    };

    // Search for relevant documentation and examples
    const searchResultsAdditional = await vectorDB.search(query, searchOptionsAdditional);
    
    // Format context for LLM using search results directly
    const formattedContext = await searchComponents(vectorDB, query, determineComponentType(query))
      .then(results => results.map((r: { component: { name: string; content: string } }) => `// ${r.component.name}\n${r.component.content}`)
      .join('\n\n'));

    // Generate component using LLM with enhanced context
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
        const newComponents = await vectorDB.search(query, {
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