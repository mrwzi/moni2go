// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignedInGate } from "../../src/components/auth/SignedInGate";
import { useAuthUser } from "../../src/lib/supabase/use-auth-user";

vi.mock("../../src/lib/supabase/use-auth-user", () => ({
  useAuthUser: vi.fn(),
}));

const mockedUseAuthUser = vi.mocked(useAuthUser);

describe("SignedInGate", () => {
  beforeEach(() => {
    mockedUseAuthUser.mockReturnValue({ status: "signed-out", user: null });
  });

  it.each([
    [
      "home",
      "Sign in to see your money.",
      "View a sample",
      "signed-out-card--home",
    ],
    [
      "accounts",
      "Your accounts are private",
      "View sample accounts",
      "signed-out-card--accounts",
    ],
    [
      "plan",
      "Your plan is private",
      "View sample plan",
      "signed-out-card--plan",
    ],
  ] as const)(
    "renders the %s signed-out experience",
    (variant, heading, sampleLabel, variantClass) => {
      const { container } = render(
        <SignedInGate variant={variant}>
          <p>Private content</p>
        </SignedInGate>,
      );

      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Sign in or create account" }),
      ).toHaveAttribute("href", "/auth");
      expect(screen.getByRole("link", { name: sampleLabel })).toHaveAttribute(
        "href",
        "/explore",
      );
      expect(screen.queryByText("Private content")).not.toBeInTheDocument();
      expect(container.firstElementChild).toHaveClass(variantClass);
    },
  );

  it("uses the same compact structure for Accounts and Plan", () => {
    const accounts = render(
      <SignedInGate variant="accounts">Accounts</SignedInGate>,
    ).container.firstElementChild;
    const plan = render(<SignedInGate variant="plan">Plan</SignedInGate>)
      .container.firstElementChild;

    expect(accounts).toHaveClass("signed-out-card--compact");
    expect(plan).toHaveClass("signed-out-card--compact");
    expect(accounts?.children.length).toBe(plan?.children.length);
    expect(
      Array.from(accounts?.children ?? [], (element) => element.className),
    ).toEqual(Array.from(plan?.children ?? [], (element) => element.className));
  });

  it("shows private content after authentication", () => {
    mockedUseAuthUser.mockReturnValue({
      status: "signed-in",
      user: { id: "user-1" } as User,
    });

    render(
      <SignedInGate variant="accounts">
        <p>Private content</p>
      </SignedInGate>,
    );

    expect(screen.getByText("Private content")).toBeVisible();
  });
});
