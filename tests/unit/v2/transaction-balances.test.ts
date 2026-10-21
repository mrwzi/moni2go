import { describe, expect, it } from "vitest";
import { financialWorkspaceSchema } from "../../../src/v2/domain/schemas";
import {
  applyExpenseBalanceEffect,
  applyIncomeBalanceEffect,
} from "../../../src/v2/domain/transaction-balances";
import type { DatedExpenseEvent } from "../../../src/v2/domain/expenses";
import type { HistoricalIncomeRecord } from "../../../src/v2/domain/income";
import type { FinancialWorkspace } from "../../../src/v2/domain/workspace";

const now = "2026-10-20T12:00:00.000Z";
const later = "2026-10-20T13:00:00.000Z";
const base = financialWorkspaceSchema.parse({
  schemaVersion: 2,
  id: "workspace-1",
  name: "My Money",
  provenance: "user-entered",
  currency: "CAD",
  asOfDate: "2026-10-20",
  timeZone: "America/Toronto",
  createdAt: now,
  updatedAt: now,
  accountGroups: [],
  assetAccounts: [
    {
      id: "cash",
      workspaceId: "workspace-1",
      createdAt: now,
      updatedAt: now,
      provenance: "user-entered",
      name: "Chequing",
      type: "chequing",
      currentValueCents: 10_000,
      valueAsOfDate: "2026-10-20",
      spendability: "spendable",
      includeInNetWorth: true,
      status: "active",
    },
    {
      id: "savings",
      workspaceId: "workspace-1",
      createdAt: now,
      updatedAt: now,
      provenance: "user-entered",
      name: "Savings",
      type: "savings",
      currentValueCents: 2_000,
      valueAsOfDate: "2026-10-20",
      spendability: "restricted",
      includeInNetWorth: true,
      status: "active",
    },
  ],
  liabilityAccounts: [
    {
      id: "card",
      workspaceId: "workspace-1",
      createdAt: now,
      updatedAt: now,
      provenance: "user-entered",
      name: "Card",
      type: "credit-card",
      currentBalanceCents: 5_000,
      balanceAsOfDate: "2026-10-20",
      includeInNetWorth: true,
      status: "active",
    },
    {
      id: "loan",
      workspaceId: "workspace-1",
      createdAt: now,
      updatedAt: now,
      provenance: "user-entered",
      name: "Loan",
      type: "personal-loan",
      currentBalanceCents: 20_000,
      balanceAsOfDate: "2026-10-20",
      includeInNetWorth: true,
      status: "active",
    },
  ],
  allocationRules: [],
  incomeSources: [],
  incomeEvents: [],
  historicalIncome: [],
  expenseDefinitions: [],
  expenseEvents: [],
  debts: [],
  goals: [],
  sinkingFunds: [],
  context: {
    country: "CA",
    preferences: {
      firstDayOfWeek: "monday",
      upcomingWindowDays: 7,
      reminders: { accountReviewCadence: "biweekly" },
    },
  },
}) as unknown as FinancialWorkspace;

function event(overrides: Partial<DatedExpenseEvent>): DatedExpenseEvent {
  return {
    id: "event-1",
    workspaceId: base.id,
    name: "Activity",
    amountCents: 1_000 as never,
    category: "other",
    nature: "variable",
    obligation: "flexible",
    dueDate: "2026-10-20" as never,
    actualDate: "2026-10-20" as never,
    status: "actual",
    provenance: "user-entered",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as DatedExpenseEvent;
}
const asset = (workspace: FinancialWorkspace, id: string) =>
  workspace.assetAccounts.find((account) => account.id === id)
    ?.currentValueCents;
const debt = (workspace: FinancialWorkspace, id: string) =>
  workspace.liabilityAccounts.find((account) => account.id === id)
    ?.currentBalanceCents;

describe("transaction balance effects", () => {
  it("applies and exactly reverses purchases, refunds, and person payments", () => {
    for (const transactionType of ["purchase", "person-payment"] as const) {
      const record = event({ accountId: "cash" as never, transactionType });
      const applied = applyExpenseBalanceEffect(
        base,
        record,
        "apply",
        "2026-10-20" as never,
        later,
      );
      expect(asset(applied, "cash")).toBe(9_000);
      expect(
        asset(
          applyExpenseBalanceEffect(
            applied,
            record,
            "reverse",
            "2026-10-20" as never,
            later,
          ),
          "cash",
        ),
      ).toBe(10_000);
    }
    const refund = event({
      accountId: "card" as never,
      transactionType: "refund",
    });
    expect(
      debt(
        applyExpenseBalanceEffect(
          base,
          refund,
          "apply",
          "2026-10-20" as never,
          later,
        ),
        "card",
      ),
    ).toBe(4_000);
  });

  it("updates both sides of transfers and savings movements", () => {
    for (const transactionType of [
      "transfer",
      "savings-contribution",
    ] as const) {
      const record = event({
        accountId: "cash" as never,
        relatedAccountId: "savings" as never,
        transactionType,
      });
      const applied = applyExpenseBalanceEffect(
        base,
        record,
        "apply",
        "2026-10-20" as never,
        later,
      );
      expect(asset(applied, "cash")).toBe(9_000);
      expect(asset(applied, "savings")).toBe(3_000);
      const reversed = applyExpenseBalanceEffect(
        applied,
        record,
        "reverse",
        "2026-10-20" as never,
        later,
      );
      expect(asset(reversed, "cash")).toBe(10_000);
      expect(asset(reversed, "savings")).toBe(2_000);
    }
  });

  it("restores cash and only known loan principal for debt payments", () => {
    const payment = event({
      accountId: "cash" as never,
      relatedAccountId: "loan" as never,
      amountCents: 1_500 as never,
      principalAmountCents: 1_000 as never,
      transactionType: "credit-card-payment",
    });
    const applied = applyExpenseBalanceEffect(
      base,
      payment,
      "apply",
      "2026-10-20" as never,
      later,
    );
    expect(asset(applied, "cash")).toBe(8_500);
    expect(debt(applied, "loan")).toBe(19_000);
    const reversed = applyExpenseBalanceEffect(
      applied,
      payment,
      "reverse",
      "2026-10-20" as never,
      later,
    );
    expect(asset(reversed, "cash")).toBe(10_000);
    expect(debt(reversed, "loan")).toBe(20_000);
  });

  it("never invents principal for an unknown legacy installment payment", () => {
    const payment = event({
      accountId: "cash" as never,
      relatedAccountId: "loan" as never,
      amountCents: 1_500 as never,
      transactionType: "credit-card-payment",
    });
    const applied = applyExpenseBalanceEffect(
      base,
      payment,
      "apply",
      "2026-10-20" as never,
      later,
    );
    expect(asset(applied, "cash")).toBe(8_500);
    expect(debt(applied, "loan")).toBe(20_000);
    const reversed = applyExpenseBalanceEffect(
      applied,
      payment,
      "reverse",
      "2026-10-20" as never,
      later,
    );
    expect(asset(reversed, "cash")).toBe(10_000);
    expect(debt(reversed, "loan")).toBe(20_000);
  });

  it("applies only newly confirmed principal when reconciling a payment", () => {
    const unknown = event({
      accountId: "cash" as never,
      relatedAccountId: "loan" as never,
      amountCents: 1_500 as never,
      transactionType: "credit-card-payment",
    });
    const confirmed = { ...unknown, principalAmountCents: 1_200 as never };
    const paid = applyExpenseBalanceEffect(
      base,
      unknown,
      "apply",
      "2026-10-20" as never,
      later,
    );
    const reversedOld = applyExpenseBalanceEffect(
      paid,
      unknown,
      "reverse",
      "2026-10-20" as never,
      later,
    );
    const reconciled = applyExpenseBalanceEffect(
      reversedOld,
      confirmed,
      "apply",
      "2026-10-20" as never,
      later,
    );
    expect(asset(reconciled, "cash")).toBe(8_500);
    expect(debt(reconciled, "loan")).toBe(18_800);
  });

  it("continues to treat a credit-card payment as full debt reduction", () => {
    const payment = event({
      accountId: "cash" as never,
      relatedAccountId: "card" as never,
      amountCents: 1_500 as never,
      transactionType: "credit-card-payment",
    });
    const applied = applyExpenseBalanceEffect(
      base,
      payment,
      "apply",
      "2026-10-20" as never,
      later,
    );
    expect(asset(applied, "cash")).toBe(8_500);
    expect(debt(applied, "card")).toBe(3_500);
  });

  it.each([
    ["entirely principal", 75_000, 134_314],
    ["split principal and interest", 60_000, 149_314],
    ["unknown allocation", undefined, 209_314],
  ] as const)(
    "records a $750 installment payment with %s safely",
    (_label, principalAmountCents, expectedDebt) => {
      const scenario = {
        ...base,
        assetAccounts: base.assetAccounts.map((account) =>
          account.id === "cash"
            ? { ...account, currentValueCents: 90_916 as never }
            : account,
        ),
        liabilityAccounts: base.liabilityAccounts.map((account) =>
          account.id === "loan"
            ? { ...account, currentBalanceCents: 209_314 as never }
            : account,
        ),
      };
      const payment = event({
        accountId: "cash" as never,
        relatedAccountId: "loan" as never,
        amountCents: 75_000 as never,
        ...(principalAmountCents === undefined
          ? {}
          : { principalAmountCents: principalAmountCents as never }),
        transactionType: "credit-card-payment",
      });
      const applied = applyExpenseBalanceEffect(
        scenario,
        payment,
        "apply",
        "2026-10-20" as never,
        later,
      );
      expect(asset(applied, "cash")).toBe(15_916);
      expect(debt(applied, "loan")).toBe(expectedDebt);
    },
  );

  it("applies and reverses recorded income without creating an expense", () => {
    const income = {
      id: "income-1",
      workspaceId: base.id,
      accountId: "cash",
      name: "Paycheque",
      amountCents: 2_500,
      receivedDate: "2026-10-20",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    } as unknown as HistoricalIncomeRecord;
    const applied = applyIncomeBalanceEffect(
      base,
      income,
      "apply",
      "2026-10-20" as never,
      later,
    );
    expect(asset(applied, "cash")).toBe(12_500);
    expect(
      asset(
        applyIncomeBalanceEffect(
          applied,
          income,
          "reverse",
          "2026-10-20" as never,
          later,
        ),
        "cash",
      ),
    ).toBe(10_000);
  });
});
