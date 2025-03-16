import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeValidator } from "../../src/validation/code-validator.js";
import { ComponentType, EditContext } from "../../src/models.js";

// Mock edit context
const mockEditContext: EditContext = {
  query: "Add validation to payment processing",
  relevantComponents: [
    {
      id: "doc1",
      type: ComponentType.Function,
      name: "processPayment",
      content: "function processPayment(amount: number) { /* ... */ }",
      metadata: {
        path: "src/functions/payment.ts",
        description: "Processes a payment transaction",
      },
    },
  ],
  suggestedChanges: [
    {
      componentId: "doc1",
      originalContent: "function processPayment(amount: number) { /* ... */ }",
      reason: "Relevant to query",
    },
  ],
};

// Mock TypeScript module
vi.mock("typescript", () => {
  const mockDiagnostic = {
    file: { fileName: "generated-code.ts" },
    start: 10,
    length: 5,
    messageText: "Mock error message",
    category: 0, // Error
    code: 1234,
  };

  const mockSourceFile = {
    fileName: "generated-code.ts",
    text: "function test() {}",
    getFullText: () => "function test() {}",
    statements: [],
  };

  const mockProgram = {
    getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
    getSemanticDiagnostics: vi.fn().mockReturnValue([]),
  };

  return {
    createSourceFile: vi.fn().mockReturnValue(mockSourceFile),
    createProgram: vi.fn().mockReturnValue(mockProgram),
    createCompilerHost: vi.fn().mockReturnValue({
      getSourceFile: vi.fn().mockReturnValue(mockSourceFile),
      getDefaultLibFileName: vi.fn().mockReturnValue("lib.d.ts"),
      writeFile: vi.fn(),
      getCurrentDirectory: vi.fn().mockReturnValue("/"),
      getCanonicalFileName: vi.fn((fileName) => fileName),
      useCaseSensitiveFileNames: vi.fn().mockReturnValue(true),
      getNewLine: vi.fn().mockReturnValue("\n"),
      fileExists: vi.fn().mockReturnValue(true),
      readFile: vi.fn().mockReturnValue(""),
    }),
    ScriptTarget: { Latest: 99 },
    ModuleKind: { ESNext: 99 },
    JsxEmit: { React: 2 },
    ModuleResolutionKind: { NodeJs: 2 },
    DiagnosticCategory: {
      Error: 0,
      Warning: 1,
      Suggestion: 2,
      Message: 3,
    },
    flattenDiagnosticMessageText: vi.fn().mockReturnValue("Flattened message"),
  };
});

describe("CodeValidator", () => {
  let validator: CodeValidator;

  beforeEach(() => {
    validator = new CodeValidator();
    vi.clearAllMocks();
  });

  describe("GIVEN a code validator", () => {
    describe("WHEN validating syntactically correct code", () => {
      it.skip("THEN should return a valid result", async () => {
        const code = "function test() { return true; }";
        const result = await validator.validateCode(code);

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeDefined();
        expect(result.errors?.length).toBe(0);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.length).toBe(0);
      });
    });

    describe("WHEN validating code with syntax errors", () => {
      it.skip("THEN should return an invalid result with errors", async () => {
        const code = "function test() { return true; ";

        // Setup mock to return syntax errors
        const mockDiagnostic = {
          file: { fileName: "generated-code.ts" },
          start: 10,
          length: 5,
          messageText: "Mock syntax error",
          category: 0, // Error
          code: 1234,
        };

        const ts = require("typescript");
        ts.createProgram().getSyntacticDiagnostics.mockReturnValueOnce([
          mockDiagnostic,
        ]);

        const result = await validator.validateCode(code);

        expect(result.isValid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.length).toBe(1);
        expect(result.errors?.[0].message).toBe("Flattened message");
      });
    });

    describe("WHEN validating code with semantic errors", () => {
      it.skip("THEN should return an invalid result with errors", async () => {
        const code = "const x: number = 'string';";

        // Setup mock to return semantic errors
        const mockDiagnostic = {
          file: { fileName: "generated-code.ts" },
          start: 10,
          length: 5,
          messageText: "Mock semantic error",
          category: 0, // Error
          code: 1234,
        };

        const ts = require("typescript");
        ts.createProgram().getSemanticDiagnostics.mockReturnValueOnce([
          mockDiagnostic,
        ]);

        const result = await validator.validateCode(code);

        expect(result.isValid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.length).toBe(1);
        expect(result.errors?.[0].message).toBe("Flattened message");
      });
    });

    describe("WHEN validating code with warnings", () => {
      it.skip("THEN should return a valid result with warnings", async () => {
        const code = "function test() { const x = 5; }";

        // Setup mock to return warnings
        const mockDiagnostic = {
          file: { fileName: "generated-code.ts" },
          start: 10,
          length: 5,
          messageText: "Mock warning",
          category: 1, // Warning
          code: 1234,
        };

        const ts = require("typescript");
        ts.createProgram().getSemanticDiagnostics.mockReturnValueOnce([
          mockDiagnostic,
        ]);

        const result = await validator.validateCode(code);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.length).toBe(1);
        expect(result.warnings?.[0].message).toBe("Flattened message");
      });
    });

    describe("WHEN validating code with suggestions", () => {
      it("THEN should include suggestions in the result", async () => {
        const code = "function test() { return true; }";
        const result = await validator.validateCodeWithSuggestions(
          code,
          mockEditContext,
        );

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toBeDefined();
        expect(Array.isArray(result.suggestions)).toBe(true);
      });
    });
  });
});
