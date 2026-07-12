// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TemplateDocument } from "./TemplateDocument";
import type { DocumentTemplate } from "@/lib/documents";

afterEach(cleanup);

const template: DocumentTemplate = {
  id: "sla",
  name: "Service Level Agreement",
  title: "Service Level Agreement",
  fields: ["Target Uptime", "Provider"],
  lines: [
    {
      depth: 0,
      marker: "1.",
      segments: [{ kind: "heading", value: "Uptime" }],
    },
    {
      depth: 1,
      marker: "1.",
      segments: [
        { kind: "text", value: "If there is a" },
        { kind: "ref", value: "Target Uptime" },
        { kind: "text", value: ", the" },
        { kind: "ref", value: "Provider" },
        { kind: "text", value: "will try." },
      ],
    },
  ],
};

describe("TemplateDocument", () => {
  it("renders the agreement's terms", () => {
    render(
      <TemplateDocument template={template} values={{}} activeField={null} />,
    );

    expect(screen.getByText("Service Level Agreement")).toBeInTheDocument();
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.getByText(/If there is a/)).toBeInTheDocument();
  });

  it("shows a value on the cover page once the assistant has it", () => {
    render(
      <TemplateDocument
        template={template}
        values={{ "Target Uptime": "99.9%" }}
        activeField={null}
      />,
    );

    expect(screen.getByText("99.9%")).toBeInTheDocument();
  });

  it("shows an unfilled value as a blank, so an unfinished agreement looks unfinished", () => {
    const { container } = render(
      <TemplateDocument template={template} values={{}} activeField={null} />,
    );

    const blanks = container.querySelectorAll(".blank");
    expect(blanks).toHaveLength(template.fields.length);
  });

  it("refers to a value by its name in the terms, not by its text", () => {
    // Substituting the value inline would break the sentence, and is not how the
    // agreement is written: the terms point at the cover page.
    const { container } = render(
      <TemplateDocument
        template={template}
        values={{ "Target Uptime": "99.9%" }}
        activeField={null}
      />,
    );

    const xref = container.querySelector(".xref");
    expect(xref).toHaveTextContent("Target Uptime");
    expect(xref).toHaveAttribute("title", "Target Uptime: 99.9%");
  });

  it("warns that it is a draft, and does not hide the warning from the printer", () => {
    // The PDF is the copy that leaves the building and might be signed, so the
    // disclaimer must not be marked no-print.
    const { container } = render(
      <TemplateDocument template={template} values={{}} activeField={null} />,
    );

    const disclaimer = container.querySelector(".disclaimer");
    expect(disclaimer).toHaveTextContent(/not legal advice/i);
    expect(disclaimer).toHaveTextContent(/reviewed by a qualified lawyer/i);
    expect(disclaimer).not.toHaveClass("no-print");
  });

  it("lights up the value the assistant just filled in", () => {
    const { container } = render(
      <TemplateDocument
        template={template}
        values={{ "Target Uptime": "99.9%" }}
        activeField="Target Uptime"
      />,
    );

    expect(container.querySelectorAll(".lit").length).toBeGreaterThan(0);
  });
});
