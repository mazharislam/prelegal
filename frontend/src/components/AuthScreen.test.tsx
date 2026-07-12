// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthScreen } from "./AuthScreen";
import { ApiError } from "@/lib/api";

const signIn = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  signIn,
  signUp,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const user = { id: 1, email: "ada@example.com", created_at: "2026-07-12" };

const email = () => screen.getByLabelText(/email/i);
const password = () => screen.getByLabelText(/password/i);
const submit = (name: RegExp) => screen.getByRole("button", { name });

async function swapToRegister() {
  await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
}

describe("AuthScreen", () => {
  it("signs an existing user in", async () => {
    signIn.mockResolvedValue(user);
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);

    await userEvent.type(email(), "ada@example.com");
    await userEvent.type(password(), "correct-horse");
    await userEvent.click(submit(/^sign in$/i));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("ada@example.com", "correct-horse"),
    );
    expect(onSignedIn).toHaveBeenCalledWith(user);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("registers a new user", async () => {
    signUp.mockResolvedValue(user);
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);

    await swapToRegister();
    await userEvent.type(email(), "ada@example.com");
    await userEvent.type(password(), "correct-horse");
    await userEvent.click(submit(/^create account$/i));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("ada@example.com", "correct-horse"),
    );
    expect(onSignedIn).toHaveBeenCalledWith(user);
  });

  it("will not register a password too short to be worth having", async () => {
    render(<AuthScreen onSignedIn={vi.fn()} />);

    await swapToRegister();
    await userEvent.type(email(), "ada@example.com");
    await userEvent.type(password(), "short");

    expect(submit(/^create account$/i)).toBeDisabled();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("shows what the backend says when the credentials are wrong", async () => {
    // The backend refuses to say which half was wrong, and so do we.
    signIn.mockRejectedValue(
      new ApiError("That email and password do not match an account.", 401),
    );
    render(<AuthScreen onSignedIn={vi.fn()} />);

    await userEvent.type(email(), "ada@example.com");
    await userEvent.type(password(), "guessing!!");
    await userEvent.click(submit(/^sign in$/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /do not match an account/i,
    );
  });

  it("shows what the backend says when the email is taken", async () => {
    signUp.mockRejectedValue(
      new ApiError("An account already exists for that email.", 409),
    );
    render(<AuthScreen onSignedIn={vi.fn()} />);

    await swapToRegister();
    await userEvent.type(email(), "ada@example.com");
    await userEvent.type(password(), "correct-horse");
    await userEvent.click(submit(/^create account$/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
    // And the user is left able to try again, or swap to signing in.
    expect(submit(/^create account$/i)).toBeEnabled();
  });

  it("cannot be submitted empty", () => {
    render(<AuthScreen onSignedIn={vi.fn()} />);

    expect(submit(/^sign in$/i)).toBeDisabled();
  });
});
