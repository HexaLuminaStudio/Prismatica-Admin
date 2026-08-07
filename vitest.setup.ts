import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia; provide a minimal stub for components that probe it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {
      // noop
    },
    removeListener: () => {
      // noop
    },
    addEventListener: () => {
      // noop
    },
    removeEventListener: () => {
      // noop
    },
    dispatchEvent: () => false,
  });
}