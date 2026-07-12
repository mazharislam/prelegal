// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NdaDocument } from "./NdaDocument";
import { DEFAULT_VALUES } from "@/lib/nda";

afterEach(cleanup);

describe("NdaDocument", () => {
  it("warns that it is a draft, and does not hide the warning from the printer", () => {
    // The PDF is the copy that leaves the building and might be signed, so the
    // disclaimer must not be marked no-print.
    const { container } = render(
      <NdaDocument values={DEFAULT_VALUES} activeField={null} />,
    );

    const disclaimer = container.querySelector(".disclaimer");
    expect(disclaimer).toHaveTextContent(/not legal advice/i);
    expect(disclaimer).toHaveTextContent(/reviewed by a qualified lawyer/i);
    expect(disclaimer).not.toHaveClass("no-print");
  });

  it("puts the warning where a signer would see it, above the signature block", () => {
    const { container } = render(
      <NdaDocument values={DEFAULT_VALUES} activeField={null} />,
    );

    const disclaimer = container.querySelector(".disclaimer");
    const signatures = container.querySelector(".signature-block");
    expect(disclaimer).toBeInTheDocument();
    expect(signatures).toBeInTheDocument();
    // compareDocumentPosition: 4 means the signature block follows the disclaimer.
    expect(
      disclaimer!.compareDocumentPosition(signatures!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
