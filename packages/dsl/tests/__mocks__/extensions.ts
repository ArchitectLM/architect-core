import { vi } from 'vitest';

// Mock for @architectlm/extensions
export const createExtensionSystem = () => ({
  registerExtensionPoint: vi.fn(),
  triggerExtensionPoint: vi.fn(),
  registerExtension: vi.fn()
});

export const ExtensionSystem = {};
export const Extension = {};
export const ExtensionPoint = {};
export const Plugin = {};
export const EventInterceptor = {};
export const DefaultExtensionSystem = {};
export const PluginManager = {
  registerPlugin: vi.fn()
}; 