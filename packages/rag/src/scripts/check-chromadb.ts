import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
import { VectorDBConfig } from '../models.js';
import { ComponentType as DslComponentType } from '@architectlm/dsl';

/**
 * Map RAG component type to DSL component type
 */
function mapComponentType(type: string): DslComponentType {
  switch (type) {
    case 'schema':
      return DslComponentType.SCHEMA;
    case 'command':
      return DslComponentType.COMMAND;
    case 'query':
      return DslComponentType.QUERY;
    case 'event':
      return DslComponentType.EVENT;
    case 'workflow':
      return DslComponentType.WORKFLOW;
    case 'extension':
      return DslComponentType.EXTENSION;
    case 'plugin':
      return DslComponentType.PLUGIN;
    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

async function checkChromaDB() {
  try {
    console.log('Initializing ChromaDB...');
    
    const config: VectorDBConfig = {
      collectionName: 'dsl-components',
      embeddingDimension: 384,
      distance: 'cosine',
    };
    
    const chromaConnector = new ChromaDBConnector(config);
    await chromaConnector.initialize();
    console.log('ChromaDB initialized successfully');

    // Check each component type
    const componentTypes = ['schema', 'command', 'query', 'event', 'workflow', 'extension', 'plugin'];
    for (const type of componentTypes) {
      console.log(`\nChecking ${type} components...`);
      const components = await chromaConnector.search('', {
        types: [type],
        limit: 100,
        threshold: 0.0,
        includeMetadata: true,
        includeEmbeddings: false,
        orderBy: 'relevance',
        orderDirection: 'desc'
      });
      
      if (components && components.length > 0) {
        console.log(`Found ${components.length} ${type} components:`);
        for (const component of components) {
          console.log('\nComponent:');
          console.log('- Name:', component.component.name);
          console.log('- Type:', component.component.type);
          console.log('- Description:', component.component.metadata.description);
          console.log('- Path:', component.component.metadata.path);
          console.log('- Tags:', component.component.metadata.tags);
          console.log('- Content Preview:', component.component.content.substring(0, 100) + '...');
        }
      } else {
        console.log(`No ${type} components found`);
      }
    }

  } catch (error) {
    console.error('Error checking ChromaDB:', error);
    process.exit(1);
  }
}

// Run the check script
checkChromaDB().catch(console.error); 