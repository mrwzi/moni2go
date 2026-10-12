"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const emailValue = form.get("email");
    const passwordValue = form.get("password");
    const email = typeof emailValue === "string" ? emailValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";
    const supabase = createClient();
    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign-up" && result.data.session === null) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-panel">
      <div className="segmented-control" aria-label="Account action">
        <button
          type="button"
          aria-pressed={mode === "sign-in"}
          onClick={() => {
            setMode("sign-in");
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "sign-up"}
          onClick={() => {
            setMode("sign-up");
          }}
        >
          Create account
        </button>
      </div>
      <form
        className="account-form auth-form"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
            minLength={8}
            required
          />
          <small>At least 8 characters</small>
        </label>
        {message && (
          <p className="form-status" role="status">
            {message}
          </p>
        )}
        <button
          className="button button-primary button-full"
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <span className="button-spinner" aria-hidden="true" />}
          <span>
            {pending
              ? mode === "sign-up"
                ? "Creating account…"
                : "Signing in…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </span>
        </button>
      </form>
      <div className="auth-divider">
        <span>or</span>
      </div>
      <Link className="button button-secondary button-full" href="/explore">
        Try a demo without signing in
      </Link>
      <p className="auth-privacy">
        moni2go never asks for bank credentials. Cloud saving is optional and
        controlled from Settings.
      </p>
    </div>
  );
}
