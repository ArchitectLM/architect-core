import { ComponentType } from '@architectlm/dsl';

/**
 * Determines the component type from a query string
 */
export function determineComponentType(query: string): ComponentType {
  const keywords = {
    [ComponentType.SCHEMA]: ['schema', 'data model', 'struct', 'profile', 'user profile', 'fields'],
    [ComponentType.COMMAND]: ['command', 'action', 'login', 'authentication', 'register'],
    [ComponentType.WORKFLOW]: ['workflow', 'process', 'pipeline', 'steps'],
    [ComponentType.PLUGIN]: ['plugin', 'extension', 'functionality'],
    [ComponentType.EVENT]: ['event', 'notification', 'message'],
    [ComponentType.QUERY]: ['query', 'get', 'retrieve', 'find'],
    [ComponentType.EXTENSION]: ['extension', 'hook', 'system extension']
  };
  
  const lowerQuery = query.toLowerCase();
  
  // Find type with most keyword matches
  let bestType = ComponentType.COMMAND; // Default
  let maxMatches = 0;
  
  for (const [type, typeKeywords] of Object.entries(keywords)) {
    const matches = typeKeywords.filter(keyword => lowerQuery.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestType = type as ComponentType;
    }
  }
  
  return bestType;
} 