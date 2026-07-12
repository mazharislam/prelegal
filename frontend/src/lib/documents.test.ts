import { describe, expect, it } from "vitest";

import {
  type DocumentTemplate,
  type FieldValues,
  mergeFields,
  missingTemplateFields,
  templateFileName,
} from "./documents";

const template: DocumentTemplate = {
  id: "csa",
  name: "Cloud Service Agreement",
  title: "Cloud Service Agreement",
  fields: ["Customer", "Provider", "Subscription Period"],
  lines: [],
};

describe("mergeFields", () => {
  it("adds the values the assistant learned", () => {
    const merged = mergeFields({ Customer: "Acme" }, { Provider: "Globex" });

    expect(merged).toEqual({ Customer: "Acme", Provider: "Globex" });
  });

  it("cannot blank out a value the user already gave", () => {
    // The same rule as the NDA's merge: a patch adds and changes, never erases.
    const merged = mergeFields({ Customer: "Acme" }, { Customer: "" });

    expect(merged.Customer).toBe("Acme");
  });
});

describe("missingTemplateFields", () => {
  it("lists what the agreement still owes, in the order it asks", () => {
    const values: FieldValues = { Provider: "Globex" };

    expect(missingTemplateFields(template, values)).toEqual([
      "Customer",
      "Subscription Period",
    ]);
  });

  it("treats whitespace as unfilled", () => {
    expect(missingTemplateFields(template, { Customer: "   " })).toContain("Customer");
  });

  it("is empty once every value is in", () => {
    const values = {
      Customer: "Acme",
      Provider: "Globex",
      "Subscription Period": "12 months",
    };

    expect(missingTemplateFields(template, values)).toEqual([]);
  });
});

describe("templateFileName", () => {
  it("names the file after the parties", () => {
    const name = templateFileName(template, {
      Customer: "Acme",
      Provider: "Globex",
    });

    expect(name).toBe("Cloud Service Agreement - Acme and Globex");
  });

  it("falls back to the agreement's name before the parties are known", () => {
    expect(templateFileName(template, {})).toBe("Cloud Service Agreement");
  });
});
