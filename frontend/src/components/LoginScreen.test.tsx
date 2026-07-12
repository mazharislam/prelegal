// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "./LoginScreen";
import { ApiError } from "@/lib/api";

const login = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  login,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const user = { id: 1, email: "ada@example.com", created_at: "2026-07-11" };

describe("LoginScreen", () => {
  it("cannot be submitted until an email is typed", async () => {
    render(<LoginScreen onSignedIn={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/email/i), "ada@example.com");

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("signs the user in and hands them back", async () => {
    login.mockResolvedValue(user);
    const onSignedIn = vi.fn();
    render(<LoginScreen onSignedIn={onSignedIn} />);

    await userEvent.type(screen.getByLabelText(/email/i), "  ada@example.com  ");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Stray whitespace is the user's, not the address's.
    await waitFor(() => expect(login).toHaveBeenCalledWith("ada@example.com"));
    expect(onSignedIn).toHaveBeenCalledWith(user);
  });

  it("explains a rejected email address", async () => {
    login.mockRejectedValue(new ApiError("Request failed (422)", 422));
    render(<LoginScreen onSignedIn={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/email/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /does not look like an email/i,
    );
  });

  it("surfaces an unreachable backend and lets the user retry", async () => {
    login.mockRejectedValue(new ApiError("Could not reach the server."));
    render(<LoginScreen onSignedIn={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/email/i), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not reach the server/i,
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
