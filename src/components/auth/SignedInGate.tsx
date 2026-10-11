"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
      </section>
    );
  return children;
}
