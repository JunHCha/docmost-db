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

// jsdom lacks IntersectionObserver; the database embed lazy-mounts its body once
// the wrapper scrolls into view (issue #39). The stub records each instance and
// its callback so tests can trigger visibility deterministically. By default it
// reports the target as immediately intersecting on observe(), so existing
// component tests that assume the body renders keep passing.
if (!("IntersectionObserver" in globalThis)) {
  const instances: any[] = [];
  class IntersectionObserverStub {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    elements = new Set<Element>();
    disconnected = false;
    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.callback = callback;
      this.options = options;
      instances.push(this);
    }
    observe(el: Element) {
      this.elements.add(el);
      // Default to visible so suites not exercising lazy mount keep working.
      // A test can set globalThis.__ioAutoIntersect = false to keep targets
      // hidden and drive visibility manually via the recorded callback.
      if ((globalThis as any).__ioAutoIntersect !== false) {
        this.callback(
          [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
    }
    trigger(isIntersecting: boolean) {
      this.callback(
        Array.from(this.elements).map(
          (target) =>
            ({ target, isIntersecting }) as IntersectionObserverEntry,
        ),
        this as unknown as IntersectionObserver,
      );
    }
    unobserve(el: Element) {
      this.elements.delete(el);
    }
    disconnect() {
      this.disconnected = true;
      this.elements.clear();
    }
    takeRecords() {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = IntersectionObserverStub;
  (globalThis as any).__intersectionObservers = instances;
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
