// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionHistory } from "../../src/components/accounts/TransactionHistory";
import { financialWorkspaceSchema } from "../../src/v2/domain/schemas";
import type { FinancialWorkspace } from "../../src/v2/domain/workspace";

const now = "2026-10-23T12:00:00.000Z";

function workspaceWithIncome(count: number): FinancialWorkspace {
  return financialWorkspaceSchema.parse({
    schemaVersion: 2,
    id: "activity-workspace",
    name: "Activity workspace",
    provenance: "user-entered",
    currency: "CAD",
    asOfDate: "2026-10-23",
    timeZone: "America/Toronto",
    createdAt: now,
    updatedAt: now,
    accountGroups: [],
    assetAccounts: [],
    liabilityAccounts: [],
    allocationRules: [],
    incomeSources: [],
    incomeEvents: [],
    historicalIncome: Array.from({ length: count }, (_, index) => ({
      id: `income-${index.toString().padStart(2, "0")}`,
      workspaceId: "activity-workspace",
      name: `Income ${(index + 1).toString()}`,
      amountCents: 100 + index,
      receivedDate: "2026-10-23",
      provenance: "user-entered",
      createdAt: `2026-10-23T12:${index.toString().padStart(2, "0")}:00.000Z`,
      updatedAt: `2026-10-23T12:${index.toString().padStart(2, "0")}:00.000Z`,
    })),
    expenseDefinitions: [],
    expenseEvents: [],
    debts: [],
    goals: [],
    sinkingFunds: [],
    balanceCorrections: [],
    context: {
      country: "CA",
      preferences: {
        firstDayOfWeek: "monday",
        upcomingWindowDays: 7,
        reminders: { accountReviewCadence: "biweekly" },
      },
    },
  }) as unknown as FinancialWorkspace;
}

describe("TransactionHistory", () => {
  it("shows 10 recent activities by default and exposes every record beyond 50", async () => {
    const user = userEvent.setup();
    render(
      <TransactionHistory workspace={workspaceWithIncome(55)} save={vi.fn()} />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Income 55")).toBeInTheDocument();
    expect(screen.queryByText("Income 1")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Show all activity (55)" }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(55);
    expect(screen.getByText("Income 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show recent 10" }),
    ).toBeInTheDocument();
  });
});
