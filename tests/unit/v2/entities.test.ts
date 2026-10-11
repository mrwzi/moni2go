import { describe, expect, it } from "vitest";
import {
  BUDGET_CATEGORY_KEYS,
  isBudgetCategoryKey,
} from "../../../src/v2/domain/budget-categories";
import { validateEventLinks } from "../../../src/v2/domain/events";
import { DEFAULT_UPCOMING_WINDOW_DAYS } from "../../../src/v2/domain/attention-types";
import {
  datedExpenseEventSchema,
  datedIncomeEventSchema,
  debtSchema,
  expenseDefinitionSchema,
  financialEventSchema,
  financialGoalSchema,
  financialWorkspaceSchema,
  incomeSourceSchema,
  legacyV1SnapshotSchema,
  sinkingFundSchema,
} from "../../../src/v2/domain/schemas";

const now = "2026-09-23T12:00:00.000Z";
const common = {
  createdAt: now,
  updatedAt: now,
  workspaceId: "workspace-1",
  provenance: "user-entered",
} as const;
const monthly = { kind: "monthly", nominalDay: 15 } as const;
const bounds = { startDate: "2026-01-01" } as const;
const assetAccount = {
  ...common,
  id: "asset-account-1",
  name: "Chequing",
  type: "chequing",
  currentValueCents: 50_000,
  valueAsOfDate: "2026-09-23",
  spendability: "spendable",
  includeInNetWorth: true,
  status: "active",
} as const;
const incomeSource = {
  ...common,
  id: "income-source-1",
  name: "Work",
  defaultAmountCents: 100_00,
  recurrence: monthly,
  bounds,
};
const incomeEvent = {
  ...common,
  id: "income-event-1",
  sourceId: "income-source-1",
  name: "Pay",
  amountCents: 100_00,
  expectedDate: "2026-10-01",
  status: "expected",
};
const expenseDefinition = {
  ...common,
  id: "expense-definition-1",
  name: "Groceries",
  amountCents: 20_00,
  category: "groceries",
  nature: "variable",
  obligation: "required",
  recurrence: monthly,
  bounds,
};
const expenseEvent = {
  ...common,
  id: "expense-event-1",
  definitionId: "expense-definition-1",
  name: "Groceries",
  amountCents: 20_00,
  category: "groceries",
  nature: "variable",
  obligation: "required",
  dueDate: "2026-10-02",
  status: "expected",
};
const debt = {
  ...common,
  id: "debt-1",
  name: "Card",
  type: "credit-card",
  currentBalanceCents: 100_000,
  balanceAsOfDate: "2026-09-23",
  interestModel: {
    kind: "apr-estimate",
    modelVersion: 1,
    aprBasisPoints: 2099,
    dayCount: "actual-365",
    interestPosting: "monthly",
    rounding: "half-away-from-zero-at-posting",
  },
  minimumPaymentCents: 5_000,
  plannedPaymentCents: 10_000,
  dueDay: 5,
};
const goal = {
  ...common,
  id: "goal-1",
  name: "Emergency",
  type: "emergency-fund",
  currentAmountCents: 10_000,
  targetAmountCents: 100_000,
  plannedContributionCents: 5_000,
  status: "active",
};
const sinking = {
  ...common,
  id: "fund-1",
  name: "Tuition",
  targetAmountCents: 300_000,
  reservedCents: 50_000,
  dueDate: "2027-01-05",
};

describe("V2 entity schemas", () => {
  it("freezes category keys without inferring obligation", () => {
    expect(BUDGET_CATEGORY_KEYS).toHaveLength(16);
    expect(isBudgetCategoryKey("groceries")).toBe(true);
    expect(isBudgetCategoryKey("unknown")).toBe(false);
    expect(expenseDefinitionSchema.parse(expenseDefinition).obligation).toBe(
      "required",
    );
  });
  it("validates income and rejects invalid income", () => {
    expect(incomeSourceSchema.safeParse(incomeSource).success).toBe(true);
    expect(datedIncomeEventSchema.safeParse(incomeEvent).success).toBe(true);
    expect(
      datedIncomeEventSchema.safeParse({ ...incomeEvent, amountCents: -1 })
        .success,
    ).toBe(false);
  });
  it("validates expenses and keeps nature separate from obligation", () => {
    expect(expenseDefinitionSchema.safeParse(expenseDefinition).success).toBe(
      true,
    );
    expect(datedExpenseEventSchema.parse(expenseEvent)).toMatchObject({
      nature: "variable",
      obligation: "required",
    });
    expect(
      datedExpenseEventSchema.parse({
        ...expenseEvent,
        accountId: "account-1",
        relatedAccountId: "account-2",
        transactionType: "refund",
      }),
    ).toMatchObject({
      accountId: "account-1",
      relatedAccountId: "account-2",
      transactionType: "refund",
    });
    expect(
      datedExpenseEventSchema.safeParse({
        ...expenseEvent,
        category: "food-ish",
      }).success,
    ).toBe(false);
  });
  it("validates supported debts and rejects unsupported interest models", () => {
    expect(debtSchema.safeParse(debt).success).toBe(true);
    expect(
      debtSchema.safeParse({ ...debt, interestModel: { kind: "promotional" } })
        .success,
    ).toBe(false);
    expect(debtSchema.safeParse({ ...debt, dueDay: 0 }).success).toBe(false);
  });
  it("validates goals and sinking funds", () => {
    expect(financialGoalSchema.safeParse(goal).success).toBe(true);
    expect(sinkingFundSchema.safeParse(sinking).success).toBe(true);
    expect(
      financialGoalSchema.safeParse({ ...goal, targetAmountCents: -1 }).success,
    ).toBe(false);
    expect(
      sinkingFundSchema.safeParse({ ...sinking, dueDate: "2026-02-29" })
        .success,
    ).toBe(false);
  });
  it("defines the default upcoming window once", () => {
    expect(DEFAULT_UPCOMING_WINDOW_DAYS).toBe(7);
  });
});

describe("normalized event and linkage contracts", () => {
  const allocation = {
    id: "event-1",
    date: "2026-10-01",
    amountCents: 1000,
    direction: "outflow",
    kind: "sinking-fund-reservation",
    sourceEntityId: "fund-1",
    obligation: "flexible",
    status: "expected",
    provenance: "user-entered",
    label: "Reserve",
    cashEffect: "spendable-cash",
    allocationLinkId: "allocation-1",
  } as const;
  const settlement = {
    id: "event-2",
    date: "2027-01-05",
    amountCents: 1000,
    direction: "outflow",
    kind: "expense",
    sourceEntityId: "expense-event-1",
    obligation: "required",
    status: "expected",
    provenance: "user-entered",
    label: "Tuition payment",
    cashEffect: "settlement-of-allocation",
    settlesAllocationLinkId: "allocation-1",
  } as const;
  it("validates event direction, magnitude, and settlement linkage", () => {
    expect(financialEventSchema.safeParse(allocation).success).toBe(true);
    expect(financialEventSchema.safeParse(settlement).success).toBe(true);
    expect(
      financialEventSchema.safeParse({ ...allocation, amountCents: -1 })
        .success,
    ).toBe(false);
    expect(
      financialEventSchema.safeParse({ ...allocation, direction: "inflow" })
        .success,
    ).toBe(false);
  });
  it("detects duplicate and missing allocation links", () => {
    expect(validateEventLinks([allocation, settlement] as never)).toEqual([]);
    expect(validateEventLinks([settlement] as never)).toEqual([
      { code: "missing-allocation", linkId: "allocation-1" },
    ]);
    expect(
      validateEventLinks([
        allocation,
        { ...allocation, id: "event-3" },
      ] as never)[0]?.code,
    ).toBe("duplicate-allocation-link");
  });
});

describe("workspace and legacy serialization", () => {
  const legacy = {
    ...common,
    id: "legacy-1",
    provenance: "legacy-v1",
    originalSavedAt: now,
    migratedAt: now,
    completeness: "monthly-aggregate-only",
    baseline: {
      incomeCents: 100_000,
      housingCents: 40_000,
      otherExpensesCents: 20_000,
      debtPaymentsCents: 5_000,
      plannedSavingsCents: 10_000,
    },
  } as const;
  const workspace = {
    schemaVersion: 2,
    id: "workspace-1",
    name: "My Money",
    provenance: "user-entered",
    currency: "CAD",
    asOfDate: "2026-09-23",
    timeZone: "America/Toronto",
    createdAt: now,
    updatedAt: now,
    assetAccounts: [assetAccount],
    liabilityAccounts: [],
    allocationRules: [],
    incomeSources: [incomeSource],
    incomeEvents: [incomeEvent],
    historicalIncome: [],
    expenseDefinitions: [expenseDefinition],
    expenseEvents: [expenseEvent],
    debts: [debt],
    goals: [goal],
    sinkingFunds: [sinking],
    context: {
      country: "CA",
      provinceOrTerritory: "ON",
      preferences: {
        firstDayOfWeek: "monday",
        upcomingWindowDays: 7,
        reminders: { accountReviewCadence: "biweekly" },
      },
    },
    legacyV1Snapshot: legacy,
  } as const;
  it("preserves only known V1 aggregate facts", () => {
    const parsed = legacyV1SnapshotSchema.parse(legacy);
    expect(parsed.baseline).toEqual(legacy.baseline);
    expect(parsed).not.toHaveProperty("incomeEvents");
    expect(parsed).not.toHaveProperty("debts");
  });
  it("round-trips a versioned JSON-safe workspace exactly", () => {
    const parsed = financialWorkspaceSchema.parse(workspace);
    const json = JSON.stringify(parsed);
    expect(json).not.toContain("[object Date]");
    const restored = financialWorkspaceSchema.parse(JSON.parse(json));
    expect(restored).toEqual(parsed);
    expect(restored.assetAccounts[0]?.currentValueCents).toBe(50_000);
    expect(restored.debts[0]?.interestModel).toMatchObject({
      aprBasisPoints: 2099,
    });
    expect(restored.asOfDate).toBe("2026-09-23");
  });
  it("rejects invalid workspace boundaries", () => {
    expect(
      financialWorkspaceSchema.safeParse({ ...workspace, schemaVersion: 3 })
        .success,
    ).toBe(false);
    expect(
      financialWorkspaceSchema.safeParse({
        ...workspace,
        asOfDate: "2026-02-29",
      }).success,
    ).toBe(false);
    expect(
      financialWorkspaceSchema.safeParse({
        ...workspace,
        incomeSources: [{ ...incomeSource, workspaceId: "another-workspace" }],
      }).success,
    ).toBe(false);
    expect(
      financialWorkspaceSchema.safeParse({
        ...workspace,
        incomeEvents: [{ ...incomeEvent, id: incomeSource.id }],
      }).success,
    ).toBe(false);
  });
});
