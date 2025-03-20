import { ChromaDBConnector } from "../vector-db/chroma-connector.js";
import { Component, ComponentType } from "../models.js";
import fs from 'fs';
import path from 'path';

async function initBaseComponents() {
  console.log('Initializing base components...');
  
  // Initialize ChromaDB connector
  const chromaConnector = new ChromaDBConnector({
    collectionName: 'dsl-components',
    persistDirectory: path.resolve(process.cwd(), '../../.chroma'),
    embeddingDimension: 1536,
    distance: 'cosine'
  });
  
  await chromaConnector.initialize();
  
  // Read base components directory
  const baseComponentsDir = path.resolve(process.cwd(), '../base-components');
  const files = fs.readdirSync(baseComponentsDir);
  
  for (const file of files) {
    if (file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(baseComponentsDir, file), 'utf-8');
      
      // Extract component metadata from content
      const componentId = content.match(/\/\/ @component id:([^\n]+)/)?.[1] || `base-${Date.now()}`;
      const componentType = content.match(/\/\/ @component type:([^\n]+)/)?.[1] || 'function';
      const componentVersion = content.match(/\/\/ @component version:([^\n]+)/)?.[1] || '1.0.0';
      const componentAuthor = content.match(/\/\/ @component author:([^\n]+)/)?.[1] || 'system';
      const componentTags = content.match(/\/\/ @component tags:([^\n]+)/)?.[1]?.split(',') || [];
      const componentDeps = content.match(/\/\/ @component dependencies:([^\n]+)/)?.[1]?.replace(/[\[\]"]/g, '').split(',') || [];
      
      // Create component
      const component: Component = {
        type: componentType as ComponentType,
        name: path.basename(file, '.ts'),
        content,
        metadata: {
          path: `src/base-components/${file}`,
          description: `Base ${componentType} component for ${path.basename(file, '.ts')}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: componentVersion,
          author: componentAuthor,
          tags: componentTags,
          dependencies: componentDeps,
        },
      };
      
      // Store component in ChromaDB
      const id = await chromaConnector.addDocument(component);
      console.log(`Stored base component: ${component.name} (${id})`);
    }
  }
  
  console.log('Base components initialized successfully!');
}

initBaseComponents().catch(console.error); 