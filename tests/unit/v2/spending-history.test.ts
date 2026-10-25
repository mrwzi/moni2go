import { describe, expect, it } from "vitest";
import type { BudgetCategoryKey } from "../../../src/v2/domain/budget-categories";
import type {
  DatedExpenseEvent,
  ExpenseTransactionType,
} from "../../../src/v2/domain/expenses";
import {
  calculateCategorySpendingHistory,
  inferBudgetCategory,
} from "../../../src/v2/domain/spending-history";
import { parseCalendarDate } from "../../../src/v2/domain/calendar";

function transaction(
  id: string,
  date: string,
  amountCents: number,
  category: BudgetCategoryKey = "groceries",
  transactionType: ExpenseTransactionType = "purchase",
): DatedExpenseEvent {
  return {
    id,
    workspaceId: "workspace-1",
    accountId: "account-1",
    name: "Transaction",
    amountCents,
    category,
    transactionType,
    nature: "variable",
    obligation: "flexible",
    dueDate: date,
    actualDate: date,
    status: "actual",
    provenance: "user-entered",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as DatedExpenseEvent;
}

const asOf = parseCalendarDate("2026-04-15");

describe("historical monthly spending", () => {
  it("reports no history instead of a zero average", () => {
    const result = calculateCategorySpendingHistory([], asOf).groceries;
    expect(result.historicalMonthlyAverageCents).toBeNull();
    expect(result.completedMonthCount).toBe(0);
  });

  it("uses one completed month's total", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("a", "2026-03-02", 4_000),
        transaction("b", "2026-03-20", 6_000),
      ],
      asOf,
    ).groceries;
    expect(result.historicalMonthlyAverageCents).toBe(10_000);
    expect(result.completedMonthCount).toBe(1);
  });

  it("averages monthly totals rather than individual transactions", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("a", "2026-01-02", 12_000),
        transaction("b", "2026-02-02", 8_000),
        transaction("c", "2026-02-20", 10_000),
        transaction("d", "2026-03-02", 15_000),
      ],
      asOf,
    ).groceries;
    expect(result.completedMonthTotals).toEqual({
      "2026-01": 12_000,
      "2026-02": 18_000,
      "2026-03": 15_000,
    });
    expect(result.historicalMonthlyAverageCents).toBe(15_000);
  });

  it("counts an unrecorded month between two observed months as zero", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("jan", "2026-01-02", 12_000),
        transaction("mar", "2026-03-02", 15_000),
      ],
      asOf,
    ).groceries;
    expect(result.completedMonthTotals).toEqual({
      "2026-01": 12_000,
      "2026-02": 0,
      "2026-03": 15_000,
    });
    expect(result.completedMonthCount).toBe(3);
    expect(result.historicalMonthlyAverageCents).toBe(9_000);
  });

  it("keeps the current partial month separate", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("old", "2026-03-02", 10_000),
        transaction("current", "2026-04-10", 7_500),
      ],
      asOf,
    ).groceries;
    expect(result.historicalMonthlyAverageCents).toBe(10_000);
    expect(result.spentThisMonthCents).toBe(7_500);
  });

  it("subtracts refunds from their original category month", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("purchase", "2026-03-02", 20_000),
        transaction("refund", "2026-03-12", 5_000, "groceries", "refund"),
      ],
      asOf,
    ).groceries;
    expect(result.historicalMonthlyAverageCents).toBe(15_000);
  });

  it("excludes transfers between owned accounts", () => {
    const result = calculateCategorySpendingHistory(
      [transaction("transfer", "2026-03-02", 50_000, "other", "transfer")],
      asOf,
    ).other;
    expect(result.historicalMonthlyAverageCents).toBeNull();
  });

  it("does not double count a credit-card balance payment", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("purchase", "2026-03-02", 10_000, "groceries"),
        transaction(
          "payment",
          "2026-03-28",
          10_000,
          "debt-payments",
          "credit-card-payment",
        ),
      ],
      asOf,
    );
    expect(result.groceries.historicalMonthlyAverageCents).toBe(10_000);
    expect(result["debt-payments"].historicalMonthlyAverageCents).toBeNull();
  });

  it("updates when a transaction is deleted, edited, or recategorized", () => {
    const original = transaction("a", "2026-03-02", 10_000);
    expect(
      calculateCategorySpendingHistory([original], asOf).groceries
        .historicalMonthlyAverageCents,
    ).toBe(10_000);
    expect(
      calculateCategorySpendingHistory([], asOf).groceries
        .historicalMonthlyAverageCents,
    ).toBeNull();
    const edited = { ...original, amountCents: 15_000 } as DatedExpenseEvent;
    expect(
      calculateCategorySpendingHistory([edited], asOf).groceries
        .historicalMonthlyAverageCents,
    ).toBe(15_000);
    const recategorized = {
      ...edited,
      category: "shopping",
    } as DatedExpenseEvent;
    const result = calculateCategorySpendingHistory([recategorized], asOf);
    expect(result.groceries.historicalMonthlyAverageCents).toBeNull();
    expect(result.shopping.historicalMonthlyAverageCents).toBe(15_000);
  });

  it("keeps savings contributions separate from consumption", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction(
          "save",
          "2026-03-02",
          30_000,
          "savings-goals",
          "savings-contribution",
        ),
        transaction("food", "2026-03-03", 10_000),
      ],
      asOf,
    );
    expect(result["savings-goals"].historicalMonthlyAverageCents).toBeNull();
    expect(result["savings-goals"].spentThisMonthCents).toBe(0);
    expect(result.groceries.historicalMonthlyAverageCents).toBe(10_000);
  });

  it("tracks education purchases and refunds but excludes debt payments", () => {
    const result = calculateCategorySpendingHistory(
      [
        transaction("tuition", "2026-03-02", 50_000, "education"),
        transaction("refund", "2026-03-03", 5_000, "education", "refund"),
        transaction(
          "student-loan",
          "2026-03-04",
          20_000,
          "education",
          "credit-card-payment",
        ),
      ],
      asOf,
    ).education;
    expect(result.historicalMonthlyAverageCents).toBe(45_000);
  });

  it("maps common descriptions to the existing categories", () => {
    expect(inferBudgetCategory("Monthly rent")).toBe("housing");
    expect(inferBudgetCategory("Coffee shop")).toBe("restaurants");
    expect(inferBudgetCategory("Uber trip")).toBe("transportation");
    expect(inferBudgetCategory("University tuition")).toBe("education");
    expect(inferBudgetCategory("Netflix streaming membership")).toBe(
      "subscriptions",
    );
    expect(inferBudgetCategory("Amazon online order")).toBe("shopping");
  });
});
