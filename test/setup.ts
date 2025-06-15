// ./test/setup.ts
import "@testing-library/jest-dom";

const MockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Radix UI uses PointerEvents, which are not available in JSDOM by default and cause some userEvent tests to fail
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
