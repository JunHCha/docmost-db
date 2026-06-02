import { vi } from "vitest";

// jsdom does not implement matchMedia; Mantine's color-scheme provider needs
// it. Provide a no-op stub so component tests can mount MantineProvider.
// jsdom lacks ResizeObserver; Mantine ScrollArea (used by Select/Menu) needs it.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
