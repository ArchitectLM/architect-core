import * as ts from 'typescript';

/**
 * Convert TypeScript code to AST JSON representation
 */
export function convertCodeToAst(code: string): any {
  // Create a source file
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    code,
    ts.ScriptTarget.Latest,
    true
  );

  // Helper function to convert node to JSON
  function nodeToJson(node: ts.Node): any {
    const result: any = {
      kind: ts.SyntaxKind[node.kind],
    };

    // Add text for identifiers and literals
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
      result.text = node.text;
    }

    // Add type information if available
    const type = sourceFile.languageService?.getTypeAtLocation(node);
    if (type) {
      result.type = type.checker.typeToString(type);
    }

    // Recursively process children
    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      result.children = children.map(child => nodeToJson(child));
    }

    return result;
  }

  return nodeToJson(sourceFile);
}

/**
 * Convert AST JSON back to TypeScript code
 */
export function convertAstToCode(ast: any): string {
  function createNodeFromJson(json: any): ts.Node {
    const kind = (ts.SyntaxKind as any)[json.kind];
    
    if (!kind) {
      throw new Error(`Unknown syntax kind: ${json.kind}`);
    }

    // Handle different node types
    if (json.kind === 'Identifier') {
      return ts.factory.createIdentifier(json.text);
    }
    
    if (json.kind === 'StringLiteral') {
      return ts.factory.createStringLiteral(json.text);
    }
    
    if (json.kind === 'NumericLiteral') {
      return ts.factory.createNumericLiteral(json.text);
    }

    // Recursively create children
    const children = json.children?.map((child: any) => createNodeFromJson(child)) || [];
    
    // Create parent node
    return ts.factory.createSourceFile(
      children,
      ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None
    );
  }

  const node = createNodeFromJson(ast);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  
  return printer.printNode(
    ts.EmitHint.Unspecified,
    node,
    ts.createSourceFile('temp.ts', '', ts.ScriptTarget.Latest)
  );
}

/**
 * Extract relevant features from AST for vector embedding
 */
export function extractAstFeatures(ast: any): string[] {
  const features: string[] = [];

  function traverse(node: any) {
    // Add node kind as feature
    features.push(node.kind);

    // Add text content for identifiers and literals
    if (node.text) {
      features.push(node.text);
    }

    // Add type information
    if (node.type) {
      features.push(node.type);
    }

    // Recursively process children
    if (node.children) {
      node.children.forEach((child: any) => traverse(child));
    }
  }

  traverse(ast);
  return features;
} 