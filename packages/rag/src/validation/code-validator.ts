/**
 * @file Code validator implementation
 * @module @architectlm/rag
 */

import * as ts from "typescript";
import { EditContext, ValidationResult } from "../models.js";

/**
 * Code validator for validating generated code
 */
export class CodeValidator {
  /**
   * Validate code against TypeScript compiler
   */
  async validateCode(
    code: string,
    context: EditContext,
  ): Promise<ValidationResult> {
    // Create a virtual file for the code
    const fileName = "generated-code.ts";
    const sourceFile = ts.createSourceFile(
      fileName,
      code,
      ts.ScriptTarget.Latest,
      true,
    );

    // Create a virtual program
    const compilerOptions = this.createCompilerOptions();
    const program = ts.createProgram({
      rootNames: [fileName],
      options: compilerOptions,
      host: this.createCompilerHost(sourceFile, code),
    });

    // Get diagnostics
    const syntacticDiagnostics = program.getSyntacticDiagnostics();
    const semanticDiagnostics = program.getSemanticDiagnostics();

    // Process diagnostics
    const errors = this.processDiagnostics(syntacticDiagnostics, true);
    const warnings = this.processDiagnostics(semanticDiagnostics, false);

    // Create validation result
    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    return result;
  }

  /**
   * Validate code and provide suggestions for improvement
   */
  async validateCodeWithSuggestions(
    code: string,
    context: EditContext,
  ): Promise<ValidationResult> {
    // First, validate the code
    const result = await this.validateCode(code, context);

    // Generate suggestions based on the code and context
    const suggestions = await this.generateSuggestions(code, context, result);

    // Add suggestions to the result
    return {
      ...result,
      suggestions,
    };
  }

  /**
   * Create compiler options for TypeScript
   * @private
   */
  private createCompilerOptions(): ts.CompilerOptions {
    return {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      noImplicitAny: true,
      strictNullChecks: true,
      baseUrl: ".",
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      paths: {
        "@architectlm/dsl": ["./node_modules/@architectlm/dsl"],
        "@architectlm/rag": ["./node_modules/@architectlm/rag"],
      },
    };
  }

  /**
   * Create a compiler host for TypeScript
   * @private
   */
  private createCompilerHost(sourceFile: ts.SourceFile, sourceCode: string): ts.CompilerHost {
    const virtualFiles = new Map<string, string>([
      [sourceFile.fileName, sourceCode],
      ["system-api.d.ts", `
        export namespace System {
          export function component(name: string, config: any): any;
          export function define(name: string, config: any): any;
        }
      `],
      ["types.d.ts", `
        export enum ComponentType {
          SCHEMA = "schema",
          COMMAND = "command",
          EVENT = "event",
          QUERY = "query",
          WORKFLOW = "workflow",
          EXTENSION = "extension",
          PLUGIN = "plugin"
        }
      `],
    ]);

    return {
      getSourceFile: (name: string) => {
        if (virtualFiles.has(name)) {
          return ts.createSourceFile(
            name,
            virtualFiles.get(name)!,
            ts.ScriptTarget.Latest,
            true
          );
        }
        return undefined;
      },
      getDefaultLibFileName: () => "lib.d.ts",
      writeFile: () => {},
      getCurrentDirectory: () => "/",
      getCanonicalFileName: (fileName: string) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      fileExists: (fileName: string) => virtualFiles.has(fileName),
      readFile: (fileName: string) => virtualFiles.get(fileName) || "",
      directoryExists: () => true,
      getDirectories: () => [],
      resolveModuleNames: (moduleNames: string[], containingFile: string) => {
        return moduleNames.map(moduleName => {
          if (moduleName.includes("system-api.js")) {
            return {
              resolvedFileName: "system-api.d.ts",
              isExternalLibraryImport: false,
              extension: ts.Extension.Dts,
            };
          }
          if (moduleName.includes("types.js")) {
            return {
              resolvedFileName: "types.d.ts",
              isExternalLibraryImport: false,
              extension: ts.Extension.Dts,
            };
          }
          return undefined;
        });
      },
    };
  }

  /**
   * Process TypeScript diagnostics into validation errors or warnings
   * @private
   */
  private processDiagnostics(
    diagnostics: readonly ts.Diagnostic[],
    isError: boolean,
  ) {
    return diagnostics
      .filter((diagnostic) =>
        isError
          ? diagnostic.category === ts.DiagnosticCategory.Error
          : diagnostic.category === ts.DiagnosticCategory.Warning,
      )
      .map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        );
        const location =
          diagnostic.file && diagnostic.start !== undefined
            ? {
                line:
                  diagnostic.file.getLineAndCharacterOfPosition(
                    diagnostic.start,
                  ).line + 1,
                column:
                  diagnostic.file.getLineAndCharacterOfPosition(
                    diagnostic.start,
                  ).character + 1,
                file: diagnostic.file.fileName,
              }
            : undefined;

        return { message, location };
      });
  }

  /**
   * Generate suggestions for code improvement
   * @private
   */
  private async generateSuggestions(
    code: string,
    context: EditContext,
    validationResult: ValidationResult,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Add suggestions based on the code structure
    if (code.includes("if (") && !code.includes("else ")) {
      suggestions.push(
        "Consider adding an else clause to handle the alternative case.",
      );
    }

    if (code.includes("try ") && !code.includes("catch ")) {
      suggestions.push("Add a catch block to handle potential errors.");
    }

    if (!code.includes("return ")) {
      suggestions.push(
        "Consider adding a return statement to make the function's output explicit.",
      );
    }

    // Add suggestions based on validation results
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      suggestions.push("Address the warnings to improve code quality.");
    }

    // Add suggestions based on context
    const componentNames = context.relevantComponents.map((c) => c.name);
    if (componentNames.some((name) => !code.includes(name))) {
      suggestions.push(
        "Consider referencing all relevant components in your implementation.",
      );
    }

    // Add general best practices
    suggestions.push("Add comments to explain complex logic.");
    suggestions.push("Consider adding input validation.");

    return suggestions;
  }
}
