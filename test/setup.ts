import "@testing-library/jest-dom";
import { URLSearchParams } from "url";

global.URLSearchParams = URLSearchParams as unknown as typeof global.URLSearchParams;

const MockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Radix UI uses PointerEvents, which are not available in JSDOM by default and cause some userEvent tests to fail
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
}
