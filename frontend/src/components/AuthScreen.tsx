"use client";

import { useState } from "react";

import { ApiError, signIn, signUp, type User } from "@/lib/api";

const MIN_PASSWORD = 8;

interface AuthScreenProps {
  onSignedIn: (user: User) => void;
}

function errorMessage(caught: unknown): string {
  if (!(caught instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  // The backend explains 409 and 401 itself, and better than we could. A 422 is
  // the credentials failing validation, and it does not say which of the two —
  // so neither do we, rather than blaming the email for a bad password.
  if (caught.status === 422) {
    return `Check the email, and use a password of at least ${MIN_PASSWORD} characters.`;
  }
  return caught.message;
}

export function AuthScreen({ onSignedIn }: AuthScreenProps) {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  /* The rule is the same on both screens, because the backend applies it to both:
   * a password too short to have been accepted at signup cannot be a real one at
   * sign-in either, and sending it would come back as a validation error blaming
   * nothing in particular. */
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const canSubmit = email.trim() !== "" && password !== "" && !tooShort && !working;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setWorking(true);
    try {
      const enter = registering ? signUp : signIn;
      onSignedIn(await enter(email.trim(), password));
    } catch (caught) {
      setError(errorMessage(caught));
      setWorking(false);
    }
  };

  const swap = () => {
    setRegistering((was) => !was);
    setError(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="text-center">
          <p className="font-[family-name:var(--font-utility)] text-[10px] font-medium tracking-[0.22em] text-blue uppercase">
            Prelegal
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-document)] text-[30px] leading-tight font-semibold text-navy">
            {registering ? "Create an account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {registering
              ? "Draft legal agreements by talking them through."
              : "Sign in to pick up your drafts."}
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="mt-7 rounded-xl border border-card-line bg-card p-6 shadow-[0_1px_2px_rgb(23_55_147/0.04),0_12px_32px_-16px_rgb(23_55_147/0.16)]"
        >
          <Field label="Email">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              aria-describedby={error ? "auth-error" : undefined}
              className={inputStyles}
            />
          </Field>

          <div className="mt-4">
            <Field label="Password">
              <input
                id="password"
                type="password"
                required
                autoComplete={registering ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={registering ? `At least ${MIN_PASSWORD} characters` : ""}
                aria-describedby={
                  tooShort ? "password-hint" : error ? "auth-error" : undefined
                }
                className={inputStyles}
              />
            </Field>
            {tooShort ? (
              <p id="password-hint" className="mt-1.5 text-[12px] text-muted">
                At least {MIN_PASSWORD} characters.
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              id="auth-error"
              role="alert"
              className="mt-4 rounded-md bg-[#fdf0ef] px-3 py-2 text-[13px] text-pencil"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-6 w-full rounded-lg bg-blue-soft px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working
              ? registering
                ? "Creating account..."
                : "Signing in..."
              : registering
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted">
          {registering ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={swap}
            className="font-medium text-blue underline-offset-2 hover:underline"
          >
            {registering ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </main>
  );
}

const inputStyles =
  "mt-1.5 w-full rounded-lg border border-card-line bg-white px-3 py-2.5 text-[15px] " +
  "text-body placeholder:text-muted/60 focus:border-blue focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ id: string }>;
}) {
  return (
    <label htmlFor={children.props.id} className="block">
      <span className="font-[family-name:var(--font-utility)] text-[11px] font-medium tracking-[0.1em] text-navy uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
