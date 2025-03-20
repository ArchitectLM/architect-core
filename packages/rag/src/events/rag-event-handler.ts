/**
 * @file RAG event handler implementation
 * @module @architectlm/rag
 */

import {
  Component,
  ComponentType,
  SearchResult,
  VectorDBConnector,
} from "../models.js";
import * as ts from "typescript";

/**
 * Interface for the reactive event bus
 */
interface ReactiveEventBus {
  subscribe<T>(eventType: string, handler: (payload: T) => void): void;
  publish<T>(eventType: string, payload: T): void;
}

/**
 * Interface for LLM service
 */
interface LLMService {
  generateComponent(
    request: string,
    componentType: ComponentType,
  ): Promise<Component>;
  generateFeedback(component: Component, userRequest: string): Promise<string>;
}

/**
 * RAG event handler for integrating with the event system
 */
export class RAGEventHandler {
  private eventBus: ReactiveEventBus;
  private vectorDB: VectorDBConnector;
  private llmService?: LLMService;

  /**
   * Create a new RAG event handler
   */
  constructor(
    eventBus: ReactiveEventBus,
    vectorDB: VectorDBConnector,
    llmService?: LLMService,
  ) {
    this.eventBus = eventBus;
    this.vectorDB = vectorDB;
    this.llmService = llmService;
  }

  /**
   * Initialize the RAG event handler
   */
  async initialize(): Promise<void> {
    // Subscribe to component events
    this.eventBus.subscribe(
      "component.created",
      this.handleComponentCreated.bind(this),
    );
    this.eventBus.subscribe(
      "component.updated",
      this.handleComponentUpdated.bind(this),
    );
    this.eventBus.subscribe(
      "component.deleted",
      this.handleComponentDeleted.bind(this),
    );
    this.eventBus.subscribe(
      "component.indexed",
      this.handleComponentIndexed.bind(this),
    );

    // Subscribe to LLM generation events
    this.eventBus.subscribe(
      "component.generate",
      this.handleComponentGenerate.bind(this),
    );

    // Subscribe to educational feedback events
    this.eventBus.subscribe(
      "component.feedback",
      this.handleComponentFeedback.bind(this),
    );
  }

  /**
   * Handle component created event
   */
  async handleComponentCreated(payload: {
    component: Component;
  }): Promise<void> {
    const { component } = payload;

    // Add the component to the vector database
    const id = await this.vectorDB.addDocument(component);

    // Publish component indexed event
    this.eventBus.publish("component.indexed", {
      component,
      id,
    });
  }

  /**
   * Handle component updated event
   */
  async handleComponentUpdated(payload: {
    component: Component;
  }): Promise<void> {
    const { component } = payload;

    // Ensure the component has an ID
    if (!component.id) {
      throw new Error("Component ID is required for updates");
    }

    // Update the component in the vector database
    await this.vectorDB.updateDocument(component.id, component);

    // Publish component indexed event
    this.eventBus.publish("component.indexed", {
      component,
      id: component.id,
    });
  }

  /**
   * Handle component deleted event
   */
  async handleComponentDeleted(payload: { id: string }): Promise<void> {
    const { id } = payload;

    // Delete the component from the vector database
    await this.vectorDB.deleteDocument(id);
  }

  /**
   * Handle component indexed event
   */
  async handleComponentIndexed(payload: {
    component: Component;
    id: string;
  }): Promise<void> {
    // This is a hook for other systems to react to component indexing
    // For now, we'll just log the event
    console.log(`Component indexed: ${payload.component.name} (${payload.id})`);
  }

  /**
   * Handle component generate event
   */
  async handleComponentGenerate(payload: {
    request: string;
    componentType: ComponentType;
    fallbackPath?: string;
  }): Promise<void> {
    const { request, componentType, fallbackPath } = payload;

    if (!this.llmService) {
      throw new Error("LLM service is required for component generation");
    }

    try {
      // First, try to search for similar components
      const results = await this.searchComponents(request, {
        types: [componentType],
        limit: 3,
      });

      if (results.length > 0) {
        // If we found similar components, publish them
        this.eventBus.publish("component.similar.found", {
          request,
          results,
        });
        return;
      }

      // If no similar components found, generate a new one
      const component = await this.llmService.generateComponent(
        request,
        componentType,
      );

      // Set a default path if none is provided
      if (!component.metadata.path && fallbackPath) {
        component.metadata.path = fallbackPath;
      }

      // Add the component to the vector database
      const id = await this.vectorDB.addDocument(component);

      // Publish component generated event
      this.eventBus.publish("component.generated", {
        request,
        component,
        id,
      });
    } catch (error) {
      // Publish error event
      this.eventBus.publish("component.generation.error", {
        request,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle component feedback event
   */
  async handleComponentFeedback(payload: {
    componentId: string;
    userRequest: string;
  }): Promise<void> {
    const { componentId, userRequest } = payload;

    if (!this.llmService) {
      throw new Error("LLM service is required for feedback generation");
    }

    try {
      // Get the component
      const component = await this.vectorDB.getDocument(componentId);

      if (!component) {
        throw new Error(`Component not found: ${componentId}`);
      }

      // Generate feedback
      const feedback = await this.llmService.generateFeedback(
        component,
        userRequest,
      );

      // Publish feedback event
      this.eventBus.publish("component.feedback.generated", {
        componentId,
        component,
        feedback,
      });
    } catch (error) {
      // Publish error event
      this.eventBus.publish("component.feedback.error", {
        componentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Index a TypeScript file
   */
  async indexTypeScriptFile(
    filePath: string,
    fileContent: string,
  ): Promise<string[]> {
    // Extract components from the file
    const components = this.extractComponentsFromTypeScript(
      filePath,
      fileContent,
    );

    // Add the components to the vector database
    const ids = await this.vectorDB.addDocuments(components);

    // Publish file indexed event
    this.eventBus.publish("file.indexed", {
      filePath,
      componentIds: ids,
    });

    return ids;
  }

  /**
   * Search for components
   */
  async searchComponents(
    query: string,
    options?: any,
  ): Promise<SearchResult[]> {
    // Search the vector database
    const results = await this.vectorDB.search(query, options);

    // Publish search completed event
    this.eventBus.publish("search.completed", {
      query,
      results,
    });

    return results;
  }

  /**
   * Extract components from TypeScript code
   * @private
   */
  private extractComponentsFromTypeScript(
    filePath: string,
    fileContent: string,
  ): Component[] {
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    );

    const components: Component[] = [];

    // Visit each node in the source file
    const visit = (node: ts.Node) => {
      // Check if node has modifiers and is exported
      const nodeAny = node as any;
      if (nodeAny.modifiers && Array.isArray(nodeAny.modifiers)) {
        const isExported = nodeAny.modifiers.some(
          (m: any) => m.kind === ts.SyntaxKind.ExportKeyword,
        );

        if (isExported) {
          let component: Component | null = null;

          if (ts.isFunctionDeclaration(node) && node.name) {
            // Extract function
            component = {
              type: ComponentType.Function,
              name: node.name.text,
              content: node.getFullText(sourceFile),
              metadata: {
                path: filePath,
                description: this.getJSDocDescription(node, sourceFile),
              },
            };
          } else if (ts.isClassDeclaration(node) && node.name) {
            // Extract class
            let type = ComponentType.Extension;
            if (node.name.text.endsWith("Command")) {
              type = ComponentType.Command;
            } else if (node.name.text.endsWith("Event")) {
              type = ComponentType.Event;
            } else if (node.name.text.endsWith("Query")) {
              type = ComponentType.Query;
            }

            component = {
              type,
              name: node.name.text,
              content: node.getFullText(sourceFile),
              metadata: {
                path: filePath,
                description: this.getJSDocDescription(node, sourceFile),
              },
            };
          } else if (
            (ts.isInterfaceDeclaration(node) ||
              ts.isTypeAliasDeclaration(node)) &&
            node.name
          ) {
            // Extract interface or type alias
            component = {
              type: ComponentType.Schema,
              name: node.name.text,
              content: node.getFullText(sourceFile),
              metadata: {
                path: filePath,
                description: this.getJSDocDescription(node, sourceFile),
              },
            };
          }

          if (component) {
            components.push(component);
          }
        }
      }

      // Continue visiting child nodes
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return components;
  }

  /**
   * Get JSDoc description for a node
   * @private
   */
  private getJSDocDescription(
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ): string {
    const nodePos = node.getFullStart();
    const nodeText = sourceFile.text.substring(0, nodePos);
    const commentRanges = ts.getLeadingCommentRanges(nodeText, nodePos) || [];

    if (commentRanges.length > 0) {
      const commentRange = commentRanges[commentRanges.length - 1];
      const comment = sourceFile.text.substring(
        commentRange.pos,
        commentRange.end,
      );

      // Extract the comment text without the comment markers
      if (comment.startsWith("/**") && comment.endsWith("*/")) {
        return comment
          .slice(3, -2)
          .split("\n")
          .map((line) => line.trim().replace(/^\s*\*\s*/, ""))
          .filter((line) => line.length > 0)
          .join("\n");
      }
    }

    return "";
  }
}
