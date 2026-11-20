"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthUser } from "../../lib/supabase/use-auth-user";
import { LoadingState } from "../shared/LoadingState";

type SignedInGateVariant = "home" | "accounts" | "plan";

const SIGNED_OUT_CONTENT: Record<
  SignedInGateVariant,
  Readonly<{
    heading: string;
    description: string;
    sampleLabel: string;
  }>
> = {
  home: {
    heading: "Sign in to see your money.",
    description:
      "Your account balances and plans stay hidden until you sign in. You can still explore synthetic examples without an account.",
    sampleLabel: "View a sample",
  },
  accounts: {
    heading: "Your accounts are private",
    description:
      "Sign in to view and manage your account balances, assets, debts, and net worth.",
    sampleLabel: "View sample accounts",
  },
  plan: {
    heading: "Your plan is private",
    description:
      "Sign in to view your budget, bills, spending history, and monthly plan.",
    sampleLabel: "View sample plan",
  },
};

const HOME_PREVIEW_STEPS = [
  {
    marker: "1",
    title: "Add what you have",
    description: "Banks, cash, and debts—entered by you.",
  },
  {
    marker: "2",
    title: "Give money a job",
    description: "Set simple monthly limits before you spend.",
  },
  {
    marker: "3",
    title: "See your next move",
    description: "Track progress with clear, honest numbers.",
  },
] as const;

function SignedOutHomePreview() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = HOME_PREVIEW_STEPS[step];
  if (!current) return null;

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setStep((currentStep) => (currentStep + 1) % HOME_PREVIEW_STEPS.length);
    }, 3200);
    return () => {
      window.clearInterval(timer);
    };
  }, [paused]);

  return (
    <div
      className="signed-out-preview"
      role="region"
      aria-label="How moni2go works"
      onMouseEnter={() => {
        setPaused(true);
      }}
      onMouseLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <div className="signed-out-preview-heading">
        <span className="eyebrow">See how it works</span>
        <span
          aria-label={`Step ${String(step + 1)} of ${String(HOME_PREVIEW_STEPS.length)}`}
        >
          {String(step + 1)}/{String(HOME_PREVIEW_STEPS.length)}
        </span>
      </div>
      <div className="signed-out-preview-stage" aria-live="polite">
        <span className="signed-out-preview-marker" aria-hidden="true">
          {current.marker}
        </span>
        <div>
          <strong>{current.title}</strong>
          <p>{current.description}</p>
        </div>
      </div>
      <div className="signed-out-preview-controls" aria-label="Preview steps">
        {HOME_PREVIEW_STEPS.map((previewStep, index) => (
          <button
            key={previewStep.marker}
            type="button"
            aria-label={`Show step ${String(index + 1)}`}
            aria-pressed={step === index}
            onClick={() => {
              setStep(index);
            }}
          />
        ))}
      </div>
      <small>Sample flow only—nothing is saved until you sign in.</small>
    </div>
  );
}

export function SignedInGate({
  children,
  variant,
}: Readonly<{ children: ReactNode; variant: SignedInGateVariant }>) {
  const auth = useAuthUser();
  const content = SIGNED_OUT_CONTENT[variant];
  if (auth.status === "loading")
    return <LoadingState label="Checking your account…" />;
  if (auth.status === "signed-out")
    return (
      <section
        className={`signed-out-card signed-out-card--${variant}${variant === "home" ? "" : " signed-out-card--compact"}`}
        data-signed-out-variant={variant}
      >
        <p className="eyebrow">Private workspace</p>
        <div className="signed-out-copy">
          <h1>{content.heading}</h1>
          <p>{content.description}</p>
        </div>
        <div className="signed-out-actions">
          <Link className="button button-primary" href="/auth">
            Sign in or create account
          </Link>
          <Link className="button button-secondary" href="/explore">
            {content.sampleLabel}
          </Link>
        </div>
        {variant === "home" && <SignedOutHomePreview />}
      </section>
    );
  return children;
}
