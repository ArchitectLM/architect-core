/**
 * Utilities for handling component tags
 */
export const tagUtils = {
  serialize(tags: string[] | undefined): string {
    return tags?.join(',') || '';
  },
  
  deserialize(tagString: string | string[] | undefined): string[] {
    if (!tagString) return [];
    if (Array.isArray(tagString)) return tagString;
    return tagString.split(',').filter(Boolean);
  },
  
  hasAllTags(componentTags: string[] | string | undefined, requiredTags: string[]): boolean {
    if (!requiredTags.length) return true;
    if (!componentTags) return false;
    
    const tags = this.deserialize(componentTags);
    return requiredTags.every(tag => tags.includes(tag));
  }
}; 