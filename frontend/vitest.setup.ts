/* DOM matchers (toBeDisabled, toHaveTextContent, ...) for component tests. */
import "@testing-library/jest-dom/vitest";

/* jsdom has no layout, so it does not implement scrollIntoView. The chat thread
 * calls it to keep the newest message in view. */
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => {};
}
