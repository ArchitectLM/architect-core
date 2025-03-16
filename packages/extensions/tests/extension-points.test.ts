import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ExtensionSystem,
  createExtensionSystem,
  ExtensionPoint,
  Extension,
  ExtensionHookHandler,
} from "../src/index.js";

describe("Extension Points", () => {
  let extensionSystem: ExtensionSystem;

  beforeEach(() => {
    extensionSystem = createExtensionSystem();
  });

  describe("GIVEN an extension system", () => {
    describe("WHEN registering an extension point", () => {
      it("THEN the extension point should be available", () => {
        // Define an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Check if the extension point exists
        expect(extensionSystem.hasExtensionPoint("test.point")).toBe(true);
      });

      it("THEN should throw an error when registering a duplicate extension point", () => {
        // Define an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Try to register the same extension point again
        expect(() => {
          extensionSystem.registerExtensionPoint(extensionPoint);
        }).toThrow(/Extension point.*already exists/);
      });
    });

    describe("WHEN registering an extension", () => {
      it("THEN the extension should be registered for the specified extension point", () => {
        // Define an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Create a mock hook handler
        const mockHookHandler: ExtensionHookHandler = vi.fn();

        // Define an extension
        const extension: Extension = {
          name: "test.extension",
          description: "Test extension",
          hooks: {
            "test.point": mockHookHandler,
          },
        };

        // Register the extension
        extensionSystem.registerExtension(extension);

        // Trigger the extension point
        extensionSystem.triggerExtensionPoint("test.point", { data: "test" });

        // Verify the hook handler was called
        expect(mockHookHandler).toHaveBeenCalledWith({ data: "test" });
      });

      it("THEN should throw an error when registering for a non-existent extension point", () => {
        // Define an extension with a hook for a non-existent extension point
        const extension: Extension = {
          name: "test.extension",
          description: "Test extension",
          hooks: {
            "non.existent.point": vi.fn(),
          },
        };

        // Try to register the extension
        expect(() => {
          extensionSystem.registerExtension(extension);
        }).toThrow(/Extension point.*does not exist/);
      });
    });

    describe("WHEN triggering an extension point", () => {
      it("THEN all registered extensions should be called", async () => {
        // Define an extension point
        const testPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(testPoint);

        // Create mock hook handlers
        const mockHookHandler1 = vi.fn();
        const mockHookHandler2 = vi.fn();

        // Define extensions
        const extension1: Extension = {
          name: "test.extension1",
          description: "Test extension 1",
          hooks: {
            "test.point": mockHookHandler1,
          },
        };

        const extension2: Extension = {
          name: "test.extension2",
          description: "Test extension 2",
          hooks: {
            "test.point": mockHookHandler2,
          },
        };

        // Register the extensions
        extensionSystem.registerExtension(extension1);
        extensionSystem.registerExtension(extension2);

        // Trigger the extension point
        const context = { data: "test" };
        await extensionSystem.triggerExtensionPoint("test.point", context);

        // Verify both hook handlers were called with the context
        expect(mockHookHandler1).toHaveBeenCalledWith(context);
        expect(mockHookHandler2).toHaveBeenCalledWith(context);
      });

      it("THEN should not throw an error when triggering a non-existent extension point", async () => {
        // Trigger a non-existent extension point
        await expect(
          extensionSystem.triggerExtensionPoint("non.existent.point", {
            data: "test",
          }),
        ).resolves.toEqual({ data: "test" });
      });
    });
  });
});
