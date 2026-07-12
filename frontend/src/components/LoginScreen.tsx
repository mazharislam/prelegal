"use client";

import { useState } from "react";

import { ApiError, login, type User } from "@/lib/api";

interface LoginScreenProps {
  onSignedIn: (user: User) => void;
}

function errorMessage(caught: unknown): string {
  if (!(caught instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  // The backend validates the address; say so in the form's own terms.
  if (caught.status === 422) return "That does not look like an email address.";
  return caught.message;
}

/**
 * The way into the platform. There is no authentication behind it: an email
 * identifies you and the account is created on the spot. The screen says so
 * rather than miming a password field it would not check.
 */
export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSigningIn(true);
    try {
      onSignedIn(await login(email.trim()));
    } catch (caught) {
      setError(errorMessage(caught));
      setSigningIn(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-desk px-5 py-12">
      <div className="w-full max-w-sm">
        <p className="font-[family-name:var(--font-utility)] text-[10px] font-medium tracking-[0.22em] text-chalk-soft uppercase">
          Prelegal
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-document)] text-[30px] leading-tight font-semibold text-chalk">
          Sign in
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-chalk-soft">
          Enter an email to open the platform. No password yet — accounts are
          created on first use.
        </p>

        <form onSubmit={submit} className="mt-8" noValidate>
          <label htmlFor="email" className="block">
            <span className="font-[family-name:var(--font-utility)] text-[11px] font-medium tracking-[0.1em] text-chalk uppercase">
              Email
            </span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              aria-describedby={error ? "login-error" : undefined}
              className="mt-2 w-full rounded-md border border-desk-line bg-desk-raised px-3 py-2.5 text-[15px] text-chalk placeholder:text-chalk-soft/50 focus:border-marker focus:outline-none"
            />
          </label>

          {error ? (
            <p id="login-error" role="alert" className="mt-3 text-[13px] text-pencil">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={signingIn || email.trim() === ""}
            className="mt-6 w-full rounded-md bg-marker px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-[#f9e9a4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingIn ? "Signing in..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
