import { describe, expect, it } from "vitest";
import {
  analyzeFinancialWorkspace,
  classifyObligations,
} from "../../../src/v2/domain/financial-insights";
import { parseCalendarDate } from "../../../src/v2/domain/calendar";
import type { FinancialWorkspace } from "../../../src/v2/domain/workspace";

const now = "2026-10-19T12:00:00.000Z";
const today = parseCalendarDate("2026-10-19");

function workspace(
  overrides: Partial<FinancialWorkspace> = {},
): FinancialWorkspace {
  return {
    schemaVersion: 2,
    id: "workspace-1",
    name: "Test workspace",
    provenance: "user-entered",
    currency: "CAD",
    asOfDate: today,
    timeZone: "America/Toronto",
    createdAt: now,
    updatedAt: now,
    accountGroups: [],
    assetAccounts: [],
    liabilityAccounts: [],
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
    ...overrides,
  } as FinancialWorkspace;
}

function chequing(cents: number) {
  return {
    id: "cash-1",
    workspaceId: "workspace-1",
    name: "Chequing",
    type: "chequing",
    currentValueCents: cents,
    valueAsOfDate: today,
    spendability: "spendable",
    includeInNetWorth: true,
    status: "active",
    provenance: "user-entered",
    createdAt: now,
    updatedAt: now,
  } as unknown as FinancialWorkspace["assetAccounts"][number];
}

function purchase(
  id: string,
  date: string,
  cents: number,
  type: "purchase" | "refund" | "transfer" | "credit-card-payment" = "purchase",
) {
  return {
    id,
    workspaceId: "workspace-1",
    name: id,
    amountCents: cents,
    category: type === "credit-card-payment" ? "debt-payments" : "groceries",
    nature: "variable",
    obligation: "flexible",
    dueDate: date,
    actualDate: date,
    status: "actual",
    transactionType: type,
    provenance: "user-entered",
    createdAt: now,
    updatedAt: now,
  } as unknown as FinancialWorkspace["expenseEvents"][number];
}

function bill(id: string, amountCents: number, day = 25) {
  return {
    id,
    workspaceId: "workspace-1",
    name: "Rent",
    amountCents,
    category: "housing",
    nature: "fixed",
    obligation: "required",
    recurrence: { kind: "monthly", nominalDay: day },
    bounds: { startDate: parseCalendarDate("2026-01-01") },
    provenance: "user-entered",
    createdAt: now,
    updatedAt: now,
  } as unknown as FinancialWorkspace["expenseDefinitions"][number];
}

describe("financial insights", () => {
  it("shows useful setup guidance with zero cash and a shortage with negative cash", () => {
    const empty = analyzeFinancialWorkspace(
      workspace({ assetAccounts: [chequing(0)] }),
      today,
    );
    expect(empty.recommendation.title).toBe(
      "Add expected income when you know it",
    );

    const negative = analyzeFinancialWorkspace(
      workspace({ assetAccounts: [chequing(-1)] }),
      today,
    );
    expect(negative.forecasts[30].shortageDate).toBe(today);
    expect(negative.recommendation.title).toBe("Cash may run short");
  });

  it("distinguishes overdue, upcoming, paid, and unknown obligations", () => {
    const data = workspace({
      expenseDefinitions: [
        bill("rent", 100_000),
        {
          ...bill("unknown", 5_000),
          name: "Variable bill",
          recurrence: { kind: "irregular" },
        },
      ],
      expenseEvents: [
        {
          ...purchase("late", "2026-10-10", 4_000),
          name: "Late utility",
          category: "utilities",
          obligation: "required",
          status: "expected",
          actualDate: undefined,
        },
        {
          ...purchase("paid", "2026-10-15", 3_000),
          name: "Paid phone",
          category: "phone-internet",
          obligation: "required",
        },
      ],
    } as unknown as Partial<FinancialWorkspace>);
    const result = classifyObligations(data, today, 30);
    expect(result.find((item) => item.name === "Late utility")?.status).toBe(
      "overdue",
    );
    expect(result.find((item) => item.name === "Rent")?.status).toBe("overdue");
    expect(result.find((item) => item.name === "Paid phone")?.status).toBe(
      "paid",
    );
    expect(result.find((item) => item.name === "Variable bill")?.status).toBe(
      "unknown",
    );
  });

  it("respects debt dates and weekly, biweekly, and monthly frequencies", () => {
    const liability = (id: string, frequency: string, date: string) => ({
      id,
      workspaceId: "workspace-1",
      name: id,
      type: "personal-loan",
      currentBalanceCents: 100_000,
      paymentRequirement: "required",
      paymentFrequency: frequency,
      requiredPaymentCents: 10_000,
      requiredMonthlyPaymentCents: 10_000,
      nextPaymentDate: date,
      balanceAsOfDate: today,
      includeInNetWorth: true,
      status: "active",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    });
    const data = workspace({
      liabilityAccounts: [
        liability("weekly", "weekly", "2026-10-20"),
        liability("biweekly", "biweekly", "2026-10-21"),
        liability("monthly", "monthly", "2026-11-18"),
      ] as never,
    });
    const result = classifyObligations(data, today, 30);
    expect(
      result.filter(
        (item) => item.kind === "debt-payment" && item.sourceId === "weekly",
      ),
    ).toHaveLength(5);
    expect(
      result.filter(
        (item) => item.kind === "debt-payment" && item.sourceId === "biweekly",
      ),
    ).toHaveLength(3);
    expect(
      result.filter(
        (item) => item.kind === "debt-payment" && item.sourceId === "monthly",
      ),
    ).toHaveLength(1);

    const future = workspace({
      assetAccounts: [chequing(20_000)],
      liabilityAccounts: [liability("later", "monthly", "2027-01-01")] as never,
    });
    expect(
      analyzeFinancialWorkspace(future, today).forecasts[30],
    ).toMatchObject({ scheduledOutflowCents: 0, shortageDate: null });
  });

  it("recognizes a recorded debt payment without rewriting its history", () => {
    const account = {
      id: "card",
      workspaceId: "workspace-1",
      name: "Credit card",
      type: "credit-card",
      currentBalanceCents: 20_000,
      paymentRequirement: "required",
      paymentFrequency: "monthly",
      requiredPaymentCents: 5_000,
      requiredMonthlyPaymentCents: 5_000,
      nextPaymentDate: "2026-10-10",
      balanceAsOfDate: today,
      includeInNetWorth: true,
      status: "active",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    } as const;
    const payment = {
      ...purchase("card-payment", "2026-10-12", 5_000, "credit-card-payment"),
      relatedAccountId: "card",
    };
    const result = classifyObligations(
      workspace({
        liabilityAccounts: [account] as never,
        expenseEvents: [payment] as never,
      }),
      today,
      30,
    );
    expect(
      result.find(
        (item) => item.kind === "debt-payment" && item.status === "paid",
      ),
    ).toMatchObject({ amountCents: 5_000, date: "2026-10-10" });
    expect(result.some((item) => item.status === "overdue")).toBe(false);
    expect(
      result.find(
        (item) => item.kind === "debt-payment" && item.status === "upcoming",
      )?.date,
    ).toBe("2026-11-10");
  });

  it("deduplicates stored records and does not double count paid bills", () => {
    const rent = bill("rent", 50_000);
    const paid = {
      ...purchase("paid-rent", "2026-10-25", 50_000),
      definitionId: "rent",
      name: "Rent",
      category: "housing",
      obligation: "required",
    } as const;
    const data = workspace({
      assetAccounts: [chequing(100_000)],
      expenseDefinitions: [rent, rent] as never,
      expenseEvents: [paid, paid] as never,
    });
    const insights = analyzeFinancialWorkspace(data, today);
    expect(
      insights.obligations.filter(
        (item) => item.name === "Rent" && item.date === "2026-10-25",
      ),
    ).toHaveLength(1);
    expect(insights.forecasts[30].scheduledOutflowCents).toBe(50_000);
    expect(insights.spending.spentThisMonthCents).toBe(50_000);
  });

  it("keeps refunds, transfers, card payments, and consumption distinct", () => {
    const data = workspace({
      expenseEvents: [
        purchase("food", "2026-10-02", 10_000),
        purchase("refund", "2026-10-03", 2_000, "refund"),
        purchase("transfer", "2026-10-04", 50_000, "transfer"),
        purchase("card", "2026-10-05", 8_000, "credit-card-payment"),
      ] as never,
    });
    expect(analyzeFinancialWorkspace(data, today).spending).toMatchObject({
      spentThisMonthCents: 8_000,
    });
  });

  it("shows actual over-plan dollars instead of clamping the result", () => {
    const data = workspace({
      expenseEvents: [purchase("food", "2026-10-02", 15_000)] as never,
      allocationRules: [
        {
          id: "groceries-plan",
          workspaceId: "workspace-1",
          name: "Groceries",
          category: "groceries",
          group: "essential-flexible",
          provenance: "user-entered",
          enabled: true,
          strategy: { kind: "fixed-amount", amountCents: 10_000 },
          createdAt: now,
          updatedAt: now,
        },
      ] as never,
    });
    const spending = analyzeFinancialWorkspace(data, today).spending;
    expect(spending.planDifferenceCents).toBe(-5_000);
    expect(spending.meaningfulOverages[0]?.amountCents).toBe(5_000);
  });

  it("uses reliable completed months for pace and forecast estimates", () => {
    const data = workspace({
      assetAccounts: [chequing(100_000)],
      expenseEvents: [
        purchase("aug", "2026-08-10", 30_000),
        purchase("sep", "2026-09-10", 30_000),
        purchase("oct", "2026-10-02", 28_000),
      ] as never,
    });
    const result = analyzeFinancialWorkspace(data, today);
    expect(result.spending.unusualCategories[0]?.category).toBe("groceries");
    expect(result.forecasts[30].estimatedOutflowCents).toBeGreaterThan(0);
  });

  it("calculates dated income and expenses across a month boundary", () => {
    const data = workspace({
      assetAccounts: [chequing(10_000)],
      incomeEvents: [
        {
          id: "pay",
          workspaceId: "workspace-1",
          name: "Pay",
          amountCents: 100_000,
          expectedDate: "2026-11-01",
          status: "expected",
          provenance: "user-entered",
          createdAt: now,
          updatedAt: now,
        },
      ] as never,
      expenseDefinitions: [bill("rent", 80_000, 2)] as never,
    });
    const forecast = analyzeFinancialWorkspace(data, today).forecasts[30];
    expect(forecast.scheduledIncomeCents).toBe(100_000);
    expect(forecast.scheduledOutflowCents).toBe(160_000);
    expect(forecast.endCashCents).toBe(-50_000);
    expect(forecast.shortageDate).toBe(today);
  });

  it("does not use investments as available cash or invent irregular income", () => {
    const investment = {
      ...chequing(500_000),
      id: "investment",
      type: "crypto",
      spendability: "non-cash",
    } as const;
    const data = workspace({
      assetAccounts: [investment] as never,
      incomeSources: [
        {
          id: "freelance",
          workspaceId: "workspace-1",
          name: "Freelance",
          defaultAmountCents: 200_000,
          recurrence: { kind: "irregular" },
          bounds: { startDate: today },
          provenance: "user-entered",
          createdAt: now,
          updatedAt: now,
        },
      ] as never,
    });
    const forecast = analyzeFinancialWorkspace(data, today).forecasts[30];
    expect(forecast.startCashCents).toBe(0);
    expect(forecast.scheduledIncomeCents).toBe(0);
    expect(forecast.unknowns).toContain(
      "Freelance has no confirmed future date.",
    );
  });

  it("does not present cash as covered when everyday spending is unknown", () => {
    const data = analyzeFinancialWorkspace(
      workspace({
        assetAccounts: [chequing(500_000)],
        incomeSources: [
          {
            id: "income-1",
            workspaceId: "workspace-1",
            name: "Known pay",
            defaultAmountCents: 100_000,
            recurrence: { kind: "monthly", nominalDay: 30 },
            bounds: { startDate: "2026-10-30" },
            provenance: "user-entered",
            createdAt: now,
            updatedAt: now,
          },
        ] as never,
      }),
      today,
    );
    expect(data.forecasts[30].estimatedOutflowCents).toBeNull();
    expect(data.recommendation).toMatchObject({
      title: "Complete your forecast",
      amountCents: null,
    });
  });

  it("keeps a missed recurring occurrence overdue", () => {
    const result = classifyObligations(
      workspace({ expenseDefinitions: [bill("rent", 100_000, 10)] as never }),
      today,
      30,
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "rent",
          date: "2026-10-10",
          status: "overdue",
          remainingCents: 100_000,
        }),
      ]),
    );
  });

  it("adds multiple partial debt payments and keeps the unpaid remainder overdue", () => {
    const account = {
      id: "card-partial",
      workspaceId: "workspace-1",
      name: "Card",
      type: "credit-card",
      currentBalanceCents: 17_000,
      paymentRequirement: "required",
      paymentFrequency: "monthly",
      requiredPaymentCents: 10_000,
      nextPaymentDate: "2026-10-10",
      balanceAsOfDate: today,
      includeInNetWorth: true,
      status: "active",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    } as const;
    const first = {
      ...purchase("part-1", "2026-10-05", 3_000, "credit-card-payment"),
      relatedAccountId: "card-partial",
    };
    const second = {
      ...purchase("part-2", "2026-10-08", 2_000, "credit-card-payment"),
      relatedAccountId: "card-partial",
    };
    const item = classifyObligations(
      workspace({
        liabilityAccounts: [account] as never,
        expenseEvents: [first, second] as never,
      }),
      today,
      30,
    ).find((obligation) => obligation.sourceId === "card-partial");
    expect(item).toMatchObject({
      status: "overdue",
      amountCents: 10_000,
      paidCents: 5_000,
      remainingCents: 5_000,
    });
  });

  it("counts a full loan payment toward the installment but only principal toward the balance", () => {
    const account = {
      id: "loan-split",
      workspaceId: "workspace-1",
      name: "Personal loan",
      type: "personal-loan",
      currentBalanceCents: 93_000,
      paymentRequirement: "required",
      paymentFrequency: "monthly",
      requiredPaymentCents: 10_000,
      nextPaymentDate: "2026-10-10",
      balanceAsOfDate: today,
      includeInNetWorth: true,
      status: "active",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    } as const;
    const payment = {
      ...purchase("loan-payment", "2026-10-08", 10_000, "credit-card-payment"),
      relatedAccountId: "loan-split",
      principalAmountCents: 7_000,
    };
    const item = classifyObligations(
      workspace({
        liabilityAccounts: [account] as never,
        expenseEvents: [payment] as never,
      }),
      today,
      30,
    ).find((obligation) => obligation.date === "2026-10-10");
    expect(item).toMatchObject({
      status: "paid",
      amountCents: 10_000,
      paidCents: 10_000,
      remainingCents: 0,
    });
  });

  it("applies early and late payments chronologically across installments", () => {
    const account = {
      id: "card-timing",
      workspaceId: "workspace-1",
      name: "Credit card",
      type: "credit-card",
      currentBalanceCents: 20_000,
      paymentRequirement: "required",
      paymentFrequency: "monthly",
      requiredPaymentCents: 10_000,
      nextPaymentDate: "2026-10-10",
      balanceAsOfDate: today,
      includeInNetWorth: true,
      status: "active",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    } as const;
    const early = {
      ...purchase("early", "2026-09-25", 6_000, "credit-card-payment"),
      relatedAccountId: "card-timing",
    };
    const late = {
      ...purchase("late", "2026-10-15", 9_000, "credit-card-payment"),
      relatedAccountId: "card-timing",
    };
    const obligations = classifyObligations(
      workspace({
        liabilityAccounts: [account] as never,
        expenseEvents: [early, late] as never,
      }),
      today,
      45,
    ).filter((item) => item.sourceId === "card-timing");
    expect(
      obligations.find((item) => item.date === "2026-10-10"),
    ).toMatchObject({
      status: "paid",
      paidCents: 10_000,
    });
    expect(
      obligations.find((item) => item.date === "2026-11-10"),
    ).toMatchObject({
      status: "upcoming",
      paidCents: 5_000,
      remainingCents: 5_000,
    });
  });

  it("deduplicates repeated IDs but preserves separate identical bills", () => {
    const first = bill("rent-a", 80_000, 25);
    const second = { ...first, id: "rent-b" };
    const repeated = classifyObligations(
      workspace({ expenseDefinitions: [first, first, second] as never }),
      today,
      10,
    ).filter((item) => item.date === "2026-10-25");
    expect(repeated).toHaveLength(2);
  });

  it("keeps paused and cancelled bill definitions out of obligations and forecasts", () => {
    const paused = { ...bill("paused", 8_000, 25), status: "paused" };
    const cancelled = {
      ...bill("cancelled", 9_000, 26),
      status: "cancelled",
    };
    const result = analyzeFinancialWorkspace(
      workspace({
        assetAccounts: [chequing(50_000)],
        expenseDefinitions: [paused, cancelled] as never,
      }),
      today,
    );
    expect(result.obligations).toEqual([]);
    expect(result.forecasts[30].scheduledOutflowCents).toBe(0);
  });

  it("classifies cancelled bills and partial linked payments without hiding them", () => {
    const definition = bill("utility", 12_000, 10);
    const partial = {
      ...purchase("utility-part", "2026-10-10", 4_000),
      definitionId: "utility",
      dueDate: "2026-10-10",
      name: "Rent",
      obligation: "required",
    };
    const item = classifyObligations(
      workspace({
        expenseDefinitions: [definition] as never,
        expenseEvents: [partial] as never,
      }),
      today,
      30,
    ).find((obligation) => obligation.date === "2026-10-10");
    expect(item).toMatchObject({ status: "overdue", remainingCents: 8_000 });

    const cancelled = { ...partial, id: "cancelled", status: "cancelled" };
    expect(
      classifyObligations(
        workspace({
          expenseDefinitions: [definition] as never,
          expenseEvents: [cancelled] as never,
        }),
        today,
        30,
      ).find((obligation) => obligation.date === "2026-10-10")?.status,
    ).toBe("cancelled");
  });

  it("marks everyday spending unknown without history and varies dated horizons", () => {
    const futureIncome = (id: string, date: string) => ({
      id,
      workspaceId: "workspace-1",
      name: "Possible pay",
      amountCents: 20_000,
      expectedDate: date,
      status: "expected",
      provenance: "user-entered",
      createdAt: now,
      updatedAt: now,
    });
    const result = analyzeFinancialWorkspace(
      workspace({
        assetAccounts: [chequing(1_000)],
        incomeEvents: [
          futureIncome("pay-45", "2026-12-03"),
          futureIncome("pay-75", "2027-01-02"),
        ] as never,
      }),
      today,
    );
    expect(result.forecasts[30].estimatedOutflowCents).toBeNull();
    expect(result.forecasts[30].unknowns.join(" ")).toContain(
      "completed-month history",
    );
    expect(result.forecasts[30].endCashCents).toBe(1_000);
    expect(result.forecasts[60].endCashCents).toBe(21_000);
    expect(result.forecasts[90].endCashCents).toBe(41_000);
  });

  it("detects a shortage before later scheduled income", () => {
    const result = analyzeFinancialWorkspace(
      workspace({
        assetAccounts: [chequing(5_000)],
        expenseDefinitions: [
          {
            ...bill("early", 10_000, 20),
            bounds: { startDate: parseCalendarDate("2026-10-20") },
          },
        ] as never,
        incomeEvents: [
          {
            id: "later-pay",
            workspaceId: "workspace-1",
            name: "Possible pay",
            amountCents: 20_000,
            expectedDate: "2026-10-21",
            status: "expected",
            provenance: "user-entered",
            createdAt: now,
            updatedAt: now,
          },
        ] as never,
      }),
      today,
    );
    expect(result.forecasts[30].shortageDate).toBe("2026-10-20");
  });
});
