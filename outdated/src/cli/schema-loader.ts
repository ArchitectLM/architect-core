/**
 * Schema Loader
 * 
 * Loads schema files from a directory or a single file.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * Type definition for schema files
 */
export interface SchemaFiles {
  [filename: string]: any;
}

/**
 * Loads schema files from a directory or a single file
 * @param filePath Path to a directory or a single file
 * @returns Object mapping filenames to their contents
 */
export async function loadSchemaFiles(filePath: string): Promise<SchemaFiles> {
  try {
    const stats = await stat(filePath);
    
    if (stats.isDirectory()) {
      return loadSchemaDirectory(filePath);
    } else {
      const content = await readFile(filePath, 'utf-8');
      const parsedContent = JSON.parse(content);
      return { [filePath]: parsedContent };
    }
  } catch (error) {
    throw new Error(`Failed to load schema files: ${error.message}`);
  }
}

/**
 * Loads all JSON files from a directory
 * @param dirPath Path to the directory
 * @returns Object mapping filenames to their contents
 */
async function loadSchemaDirectory(dirPath: string): Promise<SchemaFiles> {
  const files = await readdir(dirPath);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  const schemaFiles: SchemaFiles = {};
  
  for (const file of jsonFiles) {
    const filePath = path.join(dirPath, file);
    const content = await readFile(filePath, 'utf-8');
    try {
      const parsedContent = JSON.parse(content);
      schemaFiles[filePath] = parsedContent;
    } catch (error) {
      console.warn(`Warning: Failed to parse ${filePath} as JSON. Skipping.`);
    }
  }
  
  return schemaFiles;
}

/**
 * Recursively loads all JSON files from a directory and its subdirectories
 * @param dirPath Path to the directory
 * @returns Object mapping filenames to their contents
 */
export async function loadSchemaFilesRecursive(dirPath: string): Promise<SchemaFiles> {
  const schemaFiles: SchemaFiles = {};
  
  async function processDirectory(currentPath: string) {
    const files = await readdir(currentPath);
    
    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        await processDirectory(filePath);
      } else if (file.endsWith('.json')) {
        const content = await readFile(filePath, 'utf-8');
        try {
          const parsedContent = JSON.parse(content);
          schemaFiles[filePath] = parsedContent;
        } catch (error) {
          console.warn(`Warning: Failed to parse ${filePath} as JSON. Skipping.`);
        }
      }
    }
  }
  
  await processDirectory(dirPath);
  return schemaFiles;
} 