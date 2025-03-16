/**
 * @file Component indexer implementation
 * @module @architectlm/rag
 */

import * as ts from "typescript";
import { Component, ComponentType, VectorDBConnector } from "../models.js";

/**
 * Component indexer for extracting and indexing components
 */
export class ComponentIndexer {
  private vectorDB: VectorDBConnector;

  /**
   * Create a new component indexer
   */
  constructor(vectorDB: VectorDBConnector) {
    this.vectorDB = vectorDB;
  }

  /**
   * Index a single component
   */
  async indexComponent(component: Component): Promise<string> {
    return this.vectorDB.addDocument(component);
  }

  /**
   * Index multiple components
   */
  async indexComponents(components: Component[]): Promise<string[]> {
    return this.vectorDB.addDocuments(components);
  }

  /**
   * Index a TypeScript file
   * Extracts components from the file and indexes them
   */
  async indexTypeScriptFile(
    filePath: string,
    fileContent: string,
  ): Promise<string[]> {
    const components = this.extractComponentsFromTypeScript(
      filePath,
      fileContent,
    );
    return this.indexComponents(components);
  }

  /**
   * Update a component
   */
  async updateComponent(
    id: string,
    updates: Partial<Component>,
  ): Promise<void> {
    await this.vectorDB.updateDocument(id, updates);
  }

  /**
   * Remove a component
   */
  async removeComponent(id: string): Promise<void> {
    await this.vectorDB.deleteDocument(id);
  }

  /**
   * Clear all components
   */
  async clearAllComponents(): Promise<void> {
    await this.vectorDB.deleteAllDocuments();
  }

  /**
   * Extract components from TypeScript code
   * @private
   */
  private extractComponentsFromTypeScript(
    filePath: string,
    fileContent: string,
  ): Component[] {
    const components: Component[] = [];
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    );

    // Visit each node in the source file
    const visit = (node: ts.Node) => {
      // Extract functions
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const functionName = node.name.text;
        const functionContent = node.getFullText(sourceFile);

        // Get JSDoc comment if available
        let description = "";
        const jsDocComment = this.getJSDocComment(node, sourceFile);
        if (jsDocComment) {
          description = jsDocComment;
        }

        components.push({
          type: ComponentType.Function,
          name: functionName,
          content: functionContent,
          metadata: {
            path: filePath,
            description,
          },
        });
      }

      // Extract classes
      else if (
        ts.isClassDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const className = node.name.text;
        const classContent = node.getFullText(sourceFile);

        // Determine component type based on naming convention
        let type = ComponentType.Extension;
        if (className.endsWith("Command")) {
          type = ComponentType.Command;
        } else if (className.endsWith("Event")) {
          type = ComponentType.Event;
        } else if (className.endsWith("Query")) {
          type = ComponentType.Query;
        }

        // Get JSDoc comment if available
        let description = "";
        const jsDocComment = this.getJSDocComment(node, sourceFile);
        if (jsDocComment) {
          description = jsDocComment;
        }

        components.push({
          type,
          name: className,
          content: classContent,
          metadata: {
            path: filePath,
            description,
          },
        });
      }

      // Extract interfaces (as schemas)
      else if (
        ts.isInterfaceDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const interfaceName = node.name.text;
        const interfaceContent = node.getFullText(sourceFile);

        // Get JSDoc comment if available
        let description = "";
        const jsDocComment = this.getJSDocComment(node, sourceFile);
        if (jsDocComment) {
          description = jsDocComment;
        }

        components.push({
          type: ComponentType.Schema,
          name: interfaceName,
          content: interfaceContent,
          metadata: {
            path: filePath,
            description,
          },
        });
      }

      // Extract type aliases (as schemas)
      else if (
        ts.isTypeAliasDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const typeName = node.name.text;
        const typeContent = node.getFullText(sourceFile);

        // Get JSDoc comment if available
        let description = "";
        const jsDocComment = this.getJSDocComment(node, sourceFile);
        if (jsDocComment) {
          description = jsDocComment;
        }

        components.push({
          type: ComponentType.Schema,
          name: typeName,
          content: typeContent,
          metadata: {
            path: filePath,
            description,
          },
        });
      }

      // Continue visiting child nodes
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return components;
  }

  /**
   * Get JSDoc comment for a node
   * @private
   */
  private getJSDocComment(node: ts.Node, sourceFile: ts.SourceFile): string {
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
