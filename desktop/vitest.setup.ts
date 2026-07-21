import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Vitest doesn't auto-register RTL's cleanup the way Jest's global afterEach
// detection does, so each test's rendered DOM would otherwise leak into the
// next test within the same file.
afterEach(() => {
  cleanup();
});
