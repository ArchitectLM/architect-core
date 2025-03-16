import { describe, it, expect, beforeEach } from "vitest";
import { ValidationResult } from "../../src/models.js";
import { ErrorFormatter } from "../../src/cli/error-formatter.js";

describe("ErrorFormatter", () => {
  let errorFormatter: ErrorFormatter;

  beforeEach(() => {
    errorFormatter = new ErrorFormatter();
  });

  describe("GIVEN a validation result with errors", () => {
    describe("WHEN formatting the errors for LLM consumption", () => {
      it("THEN should format errors with line numbers and messages", () => {
        // Create a validation result with errors
        const validationResult: ValidationResult = {
          isValid: false,
          errors: [
            {
              message: "Missing semicolon",
              location: { line: 2, column: 10, file: "generated-code.ts" },
            },
            {
              message: "Unexpected token",
              location: { line: 5, column: 15, file: "generated-code.ts" },
            },
          ],
        };

        // Format errors
        const formatted = errorFormatter.format(validationResult);

        // Verify format
        expect(formatted).toContain("Line 2, Column 10: Missing semicolon");
        expect(formatted).toContain("Line 5, Column 15: Unexpected token");
        expect(formatted).toContain("Please fix the following errors:");
      });

      it("THEN should handle errors without location information", () => {
        // Create a validation result with errors missing location
        const validationResult: ValidationResult = {
          isValid: false,
          errors: [
            {
              message: "Type error in expression",
            },
            {
              message: "Cannot find module",
              location: { file: "generated-code.ts" },
            },
          ],
        };

        // Format errors
        const formatted = errorFormatter.format(validationResult);

        // Verify format
        expect(formatted).toContain("Type error in expression");
        expect(formatted).toContain("Cannot find module");
        expect(formatted).not.toContain("Line");
        expect(formatted).not.toContain("Column");
      });
    });
  });

  describe("GIVEN a validation result with warnings", () => {
    describe("WHEN formatting the warnings for LLM consumption", () => {
      it("THEN should format warnings with line numbers and messages", () => {
        // Create a validation result with warnings
        const validationResult: ValidationResult = {
          isValid: true,
          warnings: [
            {
              message: "Unused variable 'x'",
              location: { line: 3, column: 7, file: "generated-code.ts" },
            },
            {
              message: "Function lacks return type annotation",
              location: { line: 1, column: 1, file: "generated-code.ts" },
            },
          ],
        };

        // Format warnings
        const formatted = errorFormatter.format(validationResult);

        // Verify format
        expect(formatted).toContain("Line 3, Column 7: Unused variable 'x'");
        expect(formatted).toContain(
          "Line 1, Column 1: Function lacks return type annotation",
        );
        expect(formatted).toContain(
          "Please consider addressing these warnings:",
        );
      });
    });
  });

  describe("GIVEN a validation result with both errors and warnings", () => {
    describe("WHEN formatting for LLM consumption", () => {
      it("THEN should include both errors and warnings in the output", () => {
        // Create a validation result with both errors and warnings
        const validationResult: ValidationResult = {
          isValid: false,
          errors: [
            {
              message: "Missing semicolon",
              location: { line: 2, column: 10, file: "generated-code.ts" },
            },
          ],
          warnings: [
            {
              message: "Unused variable 'x'",
              location: { line: 3, column: 7, file: "generated-code.ts" },
            },
          ],
        };

        // Format result
        const formatted = errorFormatter.format(validationResult);

        // Verify format includes both errors and warnings
        expect(formatted).toContain("Please fix the following errors:");
        expect(formatted).toContain("Line 2, Column 10: Missing semicolon");
        expect(formatted).toContain(
          "Please consider addressing these warnings:",
        );
        expect(formatted).toContain("Line 3, Column 7: Unused variable 'x'");
      });
    });
  });

  describe("GIVEN a validation result with code context", () => {
    describe("WHEN formatting with code snippets", () => {
      it("THEN should include relevant code snippets around errors", () => {
        // Sample code
        const code = `function processUserJourney() {
  const discount = 0.05
  if (user.country === "US") {
    return applyDiscount(discount);
  }
  return false;
}`;

        // Create a validation result with errors
        const validationResult: ValidationResult = {
          isValid: false,
          errors: [
            {
              message: "Missing semicolon",
              location: { line: 2, column: 22, file: "generated-code.ts" },
            },
          ],
        };

        // Format with code context
        const formatted = errorFormatter.formatWithContext(
          validationResult,
          code,
        );

        // Verify format includes code snippet
        expect(formatted).toContain("Context:");
        expect(formatted).toContain("  const discount = 0.05");
        expect(formatted).toContain("Line 2, Column 22: Missing semicolon");
      });

      it("THEN should handle errors at the beginning or end of the file", () => {
        // Sample code
        const code = `function processUserJourney() {
  const discount = 0.05;
  if (user.country === "US") {
    return applyDiscount(discount);
  }
  return false;
}`;

        // Create a validation result with errors at the beginning and end
        const validationResult: ValidationResult = {
          isValid: false,
          errors: [
            {
              message: "Missing type annotation",
              location: { line: 1, column: 1, file: "generated-code.ts" },
            },
            {
              message: "Missing return type",
              location: { line: 6, column: 1, file: "generated-code.ts" },
            },
          ],
        };

        // Format with code context
        const formatted = errorFormatter.formatWithContext(
          validationResult,
          code,
        );

        // Verify format includes code snippets for both errors
        expect(formatted).toContain("Context:");
        expect(formatted).toContain("function processUserJourney() {");
        expect(formatted).toContain(
          "Line 1, Column 1: Missing type annotation",
        );
        expect(formatted).toContain("  return false;");
        expect(formatted).toContain("Line 6, Column 1: Missing return type");
      });
    });
  });

  describe("GIVEN a valid result with suggestions", () => {
    describe("WHEN formatting suggestions for LLM consumption", () => {
      it("THEN should format suggestions in a helpful way", () => {
        // Create a validation result with suggestions
        const validationResult: ValidationResult = {
          isValid: true,
          suggestions: [
            "Consider adding input validation for user.country",
            "The discount could be parameterized for flexibility",
          ],
        };

        // Format suggestions
        const formatted = errorFormatter.format(validationResult);

        // Verify format
        expect(formatted).toContain("Suggestions for improvement:");
        expect(formatted).toContain(
          "1. Consider adding input validation for user.country",
        );
        expect(formatted).toContain(
          "2. The discount could be parameterized for flexibility",
        );
      });
    });
  });
});
