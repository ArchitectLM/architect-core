import { Component, ComponentType } from '../models';

export class ComponentCache {
  private cache = new Map<string, Component>();
  private typeIndices = new Map<ComponentType, Set<string>>();
  
  add(component: Component): void {
    if (!component.id) return;
    
    this.cache.set(component.id, component);
    
    if (!this.typeIndices.has(component.type)) {
      this.typeIndices.set(component.type, new Set());
    }
    this.typeIndices.get(component.type)?.add(component.id);
  }
  
  get(id: string): Component | undefined {
    return this.cache.get(id);
  }
  
  getByType(type: ComponentType): Component[] {
    const ids = this.typeIndices.get(type) || new Set();
    return Array.from(ids)
      .map(id => this.cache.get(id))
      .filter(Boolean) as Component[];
  }
  
  clear(): void {
    this.cache.clear();
    this.typeIndices.clear();
  }
} 