// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraftList } from "./DraftList";

const listDrafts = vi.hoisted(() => vi.fn());
const deleteDraft = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listDrafts,
  deleteDraft,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const drafts = [
  {
    id: 2,
    documentType: "csa",
    name: "Cloud Service Agreement",
    blanks: 17,
    updated_at: "2026-07-12 04:00:00",
  },
  {
    id: 1,
    documentType: "mutual-nda",
    name: "Mutual Non-Disclosure Agreement",
    blanks: 0,
    updated_at: "2026-07-11 04:00:00",
  },
];

function renderList(props: Partial<Parameters<typeof DraftList>[0]> = {}) {
  const onOpen = vi.fn();
  const onNew = vi.fn();
  render(
    <DraftList
      revision={0}
      currentId={null}
      onOpen={onOpen}
      onNew={onNew}
      {...props}
    />,
  );
  return { onOpen, onNew };
}

describe("DraftList", () => {
  it("says so when there is nothing saved yet", async () => {
    listDrafts.mockResolvedValue([]);
    renderList();

    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument();
  });

  it("lists the drafts and how much each still owes", async () => {
    listDrafts.mockResolvedValue(drafts);
    renderList();

    expect(await screen.findByText("Cloud Service Agreement")).toBeInTheDocument();
    expect(screen.getByText("17 blanks left")).toBeInTheDocument();
    // A finished agreement says so rather than "0 blanks left".
    expect(screen.getByText("Ready to sign")).toBeInTheDocument();
  });

  it("opens a draft", async () => {
    listDrafts.mockResolvedValue(drafts);
    const { onOpen } = renderList();

    await userEvent.click(await screen.findByText("Cloud Service Agreement"));

    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("deletes a draft and drops it from the list", async () => {
    listDrafts.mockResolvedValue(drafts);
    deleteDraft.mockResolvedValue(undefined);
    renderList();

    await userEvent.click(
      await screen.findByRole("button", { name: /delete cloud service/i }),
    );

    await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith(2));
    expect(screen.queryByText("Cloud Service Agreement")).not.toBeInTheDocument();
    expect(screen.getByText("Mutual Non-Disclosure Agreement")).toBeInTheDocument();
  });

  it("clears the desk when the draft being deleted is the one open on it", async () => {
    listDrafts.mockResolvedValue(drafts);
    deleteDraft.mockResolvedValue(undefined);
    const { onNew } = renderList({ currentId: 2 });

    await userEvent.click(
      await screen.findByRole("button", { name: /delete cloud service/i }),
    );

    await waitFor(() => expect(onNew).toHaveBeenCalled());
  });

  it("reloads when a draft has been saved", async () => {
    listDrafts.mockResolvedValue(drafts);
    const { rerender } = render(
      <DraftList revision={0} currentId={null} onOpen={vi.fn()} onNew={vi.fn()} />,
    );
    await screen.findByText("Cloud Service Agreement");

    rerender(
      <DraftList revision={1} currentId={null} onOpen={vi.fn()} onNew={vi.fn()} />,
    );

    await waitFor(() => expect(listDrafts).toHaveBeenCalledTimes(2));
  });
});
