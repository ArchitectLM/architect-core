import { ChromaDBConnector } from '../src/vector-db/chroma-connector.js';
import { Component } from '../src/models.js';

async function main() {
  // Initialize the ChromaDB connector
  const connector = new ChromaDBConnector({
    collectionName: 'components',
    embeddingDimension: 384,
    distance: 'cosine' // Required distance metric
  });

  // Initialize the connection
  await connector.initialize();

  try {
    // Add some test components
    const testComponents: Component[] = [
      {
        type: 'schema',
        name: 'UserSchema',
        content: `
          import { System } from '../../src/system-api.js';
          import { ComponentType } from '../../src/types.js';

          export default System.component('UserSchema', {
            type: ComponentType.SCHEMA,
            description: 'User schema definition',
            tags: ['schema', 'user', 'core'],
            version: '1.0.0',
            definition: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          });
        `,
        metadata: {
          path: 'schemas/user.schema.ts',
          description: 'User schema definition',
          tags: ['schema', 'user', 'core'],
          createdAt: Date.now(),
          author: 'system',
          version: '1.0.0'
        }
      },
      {
        type: 'command',
        name: 'CreateUserCommand',
        content: `
          import { System } from '../../src/system-api.js';
          import { ComponentType } from '../../src/types.js';

          export default System.component('CreateUserCommand', {
            type: ComponentType.COMMAND,
            description: 'Command to create a new user',
            tags: ['command', 'user', 'write'],
            version: '1.0.0',
            input: {
              ref: 'UserSchema',
              description: 'User data to create'
            },
            output: {
              ref: 'UserSchema',
              description: 'Created user data'
            }
          });
        `,
        metadata: {
          path: 'commands/create-user.command.ts',
          description: 'Command to create a new user',
          tags: ['command', 'user', 'write'],
          createdAt: Date.now(),
          author: 'system',
          version: '1.0.0'
        }
      }
    ];

    console.log('Adding test components...');
    const ids = await connector.addDocuments(testComponents);
    console.log('Added components with IDs:', ids);

    // Query for all components with 'documentation' in content or metadata
    const results = await connector.search('documentation', {
      limit: 10,
      threshold: 0.5,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    console.log('\nFound components with documentation:');
    results.forEach((result: { component: Component; score: number }) => {
      console.log('\n-------------------');
      console.log(`Name: ${result.component.name}`);
      console.log(`Type: ${result.component.type}`);
      console.log(`Tags: ${result.component.metadata.tags}`);
      console.log(`Score: ${result.score}`);
      console.log('Content preview:', result.component.content.substring(0, 200) + '...');
    });

    // Query for all components
    const allResults = await connector.search('', {
      limit: 20,
      threshold: 0.5,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    console.log('\n\nAll components in database:');
    allResults.forEach((result: { component: Component; score: number }) => {
      console.log('\n-------------------');
      console.log(`Name: ${result.component.name}`);
      console.log(`Type: ${result.component.type}`);
      console.log(`Tags: ${result.component.metadata.tags}`);
    });

  } catch (error) {
    console.error('Error querying ChromaDB:', error);
  }
}

main().catch(console.error); 