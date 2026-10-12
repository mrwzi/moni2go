import { z } from "zod";
import { baselineSchema } from "../../domain/schemas";
import { parseCalendarDate } from "./calendar";
import { BUDGET_CATEGORY_KEYS } from "./budget-categories";
import {
  ASSET_ACCOUNT_TYPES,
  DEBT_PAYMENT_FREQUENCIES,
  DEBT_PAYMENT_REQUIREMENTS,
  LIABILITY_ACCOUNT_TYPES,
  SPENDABILITY_TYPES,
  deriveNetWorthCents,
  deriveSpendableCashCents,
} from "./accounts";
import { ACCOUNT_GROUP_TYPES } from "./account-groups";
import { EXPENSE_TRANSACTION_TYPES } from "./expenses";
import { PLANNING_GROUPS, REMINDER_CADENCES } from "./planning";
import { MAX_APR_BASIS_POINTS } from "./percentage";
import { MAX_V2_CENTS } from "./money";
import {
  CANADIAN_REGION_CODES,
  V2_WORKSPACE_SCHEMA_VERSION,
} from "./workspace";

export const calendarDateSchema = z.string().transform((value, ctx) => {
  try {
    return parseCalendarDate(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid calendar date." });
    return z.NEVER;
  }
});
export const entityIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
export const instantSchema = z.iso.datetime();
export const provenanceSchema = z.enum([
  "user-entered",
  "synthetic-demo",
  "legacy-v1",
  "imported-local",
]);
export const eventStatusSchema = z.enum(["expected", "actual", "cancelled"]);
export const obligationSchema = z.enum(["required", "flexible", "optional"]);
export const v2CentsSchema = z
  .number()
  .int()
  .min(-MAX_V2_CENTS)
  .max(MAX_V2_CENTS);
export const nonNegativeV2CentsSchema = v2CentsSchema.min(0);
export const basisPointsSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_APR_BASIS_POINTS);
export const categorySchema = z.enum(BUDGET_CATEGORY_KEYS);
const metadata = { createdAt: instantSchema, updatedAt: instantSchema };
const recurrenceSchema: z.ZodType = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("weekly"),
      intervalWeeks: z.number().int().positive(),
      weekday: z.number().int().min(1).max(7),
    })
    .strict(),
  z
    .object({ kind: z.literal("biweekly"), anchorDate: calendarDateSchema })
    .strict(),
  z
    .object({
      kind: z.literal("semimonthly"),
      firstDay: z.number().int().min(1).max(31),
      secondDay: z.number().int().min(1).max(31),
    })
    .strict()
    .refine((v) => v.firstDay < v.secondDay),
  z
    .object({
      kind: z.literal("monthly"),
      nominalDay: z.number().int().min(1).max(31),
    })
    .strict(),
  z.object({ kind: z.literal("one-time"), date: calendarDateSchema }).strict(),
  z.object({ kind: z.literal("irregular") }).strict(),
]);
export { recurrenceSchema };
export const recurrenceBoundsSchema = z
  .object({
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.optional(),
  })
  .strict()
  .refine((v) => v.endDate === undefined || v.startDate <= v.endDate);
const commonEntity = {
  ...metadata,
  id: entityIdSchema,
  workspaceId: entityIdSchema,
  provenance: provenanceSchema,
};
export const accountGroupSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    type: z.enum(ACCOUNT_GROUP_TYPES),
    status: z.enum(["active", "archived"]),
  })
  .strict();
export const assetAccountSchema = z
  .object({
    ...commonEntity,
    groupId: entityIdSchema.optional(),
    name: z.string().trim().min(1).max(120),
    type: z.enum(ASSET_ACCOUNT_TYPES),
    currentValueCents: v2CentsSchema,
    valueAsOfDate: calendarDateSchema,
    spendability: z.enum(SPENDABILITY_TYPES),
    includeInNetWorth: z.boolean(),
    status: z.enum(["active", "archived"]),
    institutionLabel: z.string().trim().min(1).max(120).optional(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export const liabilityAccountSchema = z
  .object({
    ...commonEntity,
    groupId: entityIdSchema.optional(),
    name: z.string().trim().min(1).max(120),
    type: z.enum(LIABILITY_ACCOUNT_TYPES),
    currentBalanceCents: nonNegativeV2CentsSchema,
    paymentRequirement: z.enum(DEBT_PAYMENT_REQUIREMENTS).optional(),
    paymentFrequency: z.enum(DEBT_PAYMENT_FREQUENCIES).optional(),
    requiredPaymentCents: nonNegativeV2CentsSchema.optional(),
    requiredMonthlyPaymentCents: nonNegativeV2CentsSchema.optional(),
    nextPaymentDate: calendarDateSchema.optional(),
    targetPayoffDate: calendarDateSchema.optional(),
    paymentDueDay: z.number().int().min(1).max(31).optional(),
    balanceAsOfDate: calendarDateSchema,
    includeInNetWorth: z.boolean(),
    status: z.enum(["active", "archived"]),
    institutionLabel: z.string().trim().min(1).max(120).optional(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((account, context) => {
    if (
      account.paymentRequirement === "required" &&
      account.currentBalanceCents > 0 &&
      account.requiredMonthlyPaymentCents === undefined
    )
      context.addIssue({
        code: "custom",
        path: ["requiredMonthlyPaymentCents"],
        message: "A required debt payment needs a monthly amount.",
      });
    if (
      account.paymentRequirement === "flexible" &&
      (account.requiredMonthlyPaymentCents !== undefined ||
        account.requiredPaymentCents !== undefined)
    )
      context.addIssue({
        code: "custom",
        path: ["requiredMonthlyPaymentCents"],
        message: "A flexible debt must not store a required payment.",
      });
    if (
      account.paymentRequirement === "required" &&
      account.requiredPaymentCents !== undefined &&
      account.paymentFrequency === undefined
    )
      context.addIssue({
        code: "custom",
        path: ["paymentFrequency"],
        message: "A scheduled payment needs a frequency.",
      });
  });
export const allocationRuleSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    category: categorySchema.optional(),
    group: z.enum(PLANNING_GROUPS),
    enabled: z.boolean(),
    strategy: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("fixed-amount"),
          amountCents: nonNegativeV2CentsSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("percentage-of-income"),
          basisPoints: z.number().int().min(0).max(10_000),
        })
        .strict(),
      z.object({ kind: z.literal("reserve-for-obligations") }).strict(),
      z.object({ kind: z.literal("debt-minimums") }).strict(),
    ]),
  })
  .strict();
export const incomeSourceSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    defaultAmountCents: nonNegativeV2CentsSchema.optional(),
    recurrence: recurrenceSchema,
    bounds: recurrenceBoundsSchema,
  })
  .strict();
export const historicalIncomeRecordSchema = z
  .object({
    ...commonEntity,
    sourceId: entityIdSchema.optional(),
    name: z.string().trim().min(1).max(120),
    amountCents: nonNegativeV2CentsSchema,
    receivedDate: calendarDateSchema,
  })
  .strict();
export const datedIncomeEventSchema = z
  .object({
    ...commonEntity,
    sourceId: entityIdSchema.optional(),
    name: z.string().trim().min(1).max(120),
    amountCents: nonNegativeV2CentsSchema,
    expectedDate: calendarDateSchema,
    status: eventStatusSchema,
    actualDate: calendarDateSchema.optional(),
  })
  .strict();
export const expenseDefinitionSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    amountCents: nonNegativeV2CentsSchema,
    category: categorySchema,
    nature: z.enum(["fixed", "variable", "periodic", "unexpected"]),
    obligation: obligationSchema,
    recurrence: recurrenceSchema,
    bounds: recurrenceBoundsSchema,
  })
  .strict();
export const datedExpenseEventSchema = z
  .object({
    ...commonEntity,
    definitionId: entityIdSchema.optional(),
    name: z.string().trim().min(1).max(120),
    amountCents: nonNegativeV2CentsSchema,
    category: categorySchema,
    nature: z.enum(["fixed", "variable", "periodic", "unexpected"]),
    obligation: obligationSchema,
    dueDate: calendarDateSchema,
    status: eventStatusSchema,
    actualDate: calendarDateSchema.optional(),
    accountId: entityIdSchema.optional(),
    relatedAccountId: entityIdSchema.optional(),
    transactionType: z.enum(EXPENSE_TRANSACTION_TYPES).optional(),
  })
  .strict();
export const debtInterestModelSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("interest-free"), modelVersion: z.literal(1) })
    .strict(),
  z
    .object({
      kind: z.literal("apr-estimate"),
      modelVersion: z.literal(1),
      aprBasisPoints: basisPointsSchema,
      dayCount: z.literal("actual-365"),
      interestPosting: z.literal("monthly"),
      rounding: z.literal("half-away-from-zero-at-posting"),
    })
    .strict(),
]);
export const debtSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    type: z.enum([
      "credit-card",
      "line-of-credit",
      "student-loan",
      "personal-loan",
      "auto-loan",
      "family",
      "other",
    ]),
    currentBalanceCents: nonNegativeV2CentsSchema,
    balanceAsOfDate: calendarDateSchema,
    interestModel: debtInterestModelSchema,
    minimumPaymentCents: nonNegativeV2CentsSchema,
    plannedPaymentCents: nonNegativeV2CentsSchema,
    dueDay: z.number().int().min(1).max(31),
    deadline: calendarDateSchema.optional(),
  })
  .strict();
export const financialGoalSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    type: z.enum([
      "emergency-fund",
      "tuition",
      "vehicle",
      "travel",
      "general-savings",
      "custom",
    ]),
    currentAmountCents: nonNegativeV2CentsSchema,
    targetAmountCents: nonNegativeV2CentsSchema,
    plannedContributionCents: nonNegativeV2CentsSchema,
    contributionRecurrence: recurrenceSchema.optional(),
    deadline: calendarDateSchema.optional(),
    status: z.enum(["active", "paused", "completed"]),
  })
  .strict();
export const sinkingFundSchema = z
  .object({
    ...commonEntity,
    name: z.string().trim().min(1).max(120),
    targetAmountCents: nonNegativeV2CentsSchema,
    reservedCents: nonNegativeV2CentsSchema,
    dueDate: calendarDateSchema,
    contributionRecurrence: recurrenceSchema.optional(),
    nextContributionDate: calendarDateSchema.optional(),
    linkedExpenseEventId: entityIdSchema.optional(),
  })
  .strict();
export const financialEventSchema = z
  .object({
    id: entityIdSchema,
    date: calendarDateSchema,
    amountCents: nonNegativeV2CentsSchema,
    direction: z.enum(["inflow", "outflow"]),
    kind: z.enum([
      "income",
      "expense",
      "debt-payment",
      "goal-transfer",
      "sinking-fund-reservation",
    ]),
    sourceEntityId: entityIdSchema,
    obligation: obligationSchema,
    status: eventStatusSchema,
    provenance: provenanceSchema,
    label: z.string().trim().min(1).max(160),
    cashEffect: z.enum([
      "spendable-cash",
      "allocation-only",
      "settlement-of-allocation",
    ]),
    allocationLinkId: entityIdSchema.optional(),
    settlesAllocationLinkId: entityIdSchema.optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.kind === "income" && event.direction !== "inflow")
      ctx.addIssue({ code: "custom", message: "Income must be an inflow." });
    if (event.kind !== "income" && event.direction !== "outflow")
      ctx.addIssue({
        code: "custom",
        message: "Non-income events must be outflows.",
      });
    if (
      event.cashEffect === "allocation-only" &&
      !["goal-transfer", "sinking-fund-reservation"].includes(event.kind)
    )
      ctx.addIssue({
        code: "custom",
        message: "Only allocation events may be allocation-only.",
      });
    if (
      event.cashEffect === "settlement-of-allocation" &&
      event.settlesAllocationLinkId === undefined
    )
      ctx.addIssue({
        code: "custom",
        message: "Allocation settlement requires a link.",
      });
  });
export const legacyV1SnapshotSchema = z
  .object({
    ...metadata,
    id: entityIdSchema,
    workspaceId: entityIdSchema,
    provenance: z.literal("legacy-v1"),
    originalSavedAt: instantSchema,
    migratedAt: instantSchema,
    completeness: z.literal("monthly-aggregate-only"),
    baseline: baselineSchema,
  })
  .strict();
export const financialWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(V2_WORKSPACE_SCHEMA_VERSION),
    ...metadata,
    id: entityIdSchema,
    name: z.string().trim().min(1).max(120),
    provenance: provenanceSchema,
    currency: z.literal("CAD"),
    asOfDate: calendarDateSchema,
    timeZone: z.string().trim().min(1).max(80),
    accountGroups: z.array(accountGroupSchema).default([]),
    assetAccounts: z.array(assetAccountSchema),
    liabilityAccounts: z.array(liabilityAccountSchema),
    allocationRules: z.array(allocationRuleSchema),
    incomeSources: z.array(incomeSourceSchema),
    incomeEvents: z.array(datedIncomeEventSchema),
    historicalIncome: z.array(historicalIncomeRecordSchema),
    expenseDefinitions: z.array(expenseDefinitionSchema),
    expenseEvents: z.array(datedExpenseEventSchema),
    debts: z.array(debtSchema),
    goals: z.array(financialGoalSchema),
    sinkingFunds: z.array(sinkingFundSchema),
    context: z
      .object({
        country: z.literal("CA"),
        provinceOrTerritory: z.enum(CANADIAN_REGION_CODES).optional(),
        populationCentre: z
          .object({ code: z.string().min(1), label: z.string().min(1) })
          .strict()
          .optional(),
        preferences: z
          .object({
            firstDayOfWeek: z.enum(["monday", "sunday"]),
            upcomingWindowDays: z.number().int().positive(),
            reminders: z
              .object({ accountReviewCadence: z.enum(REMINDER_CADENCES) })
              .strict(),
          })
          .strict(),
      })
      .strict(),
    legacyV1Snapshot: legacyV1SnapshotSchema.optional(),
  })
  .strict()
  .superRefine((workspace, context) => {
    try {
      deriveSpendableCashCents(workspace.assetAccounts as never);
      deriveNetWorthCents(
        workspace.assetAccounts as never,
        workspace.liabilityAccounts as never,
      );
    } catch {
      context.addIssue({
        code: "custom",
        message: "Derived account totals exceed the V2 money limit.",
      });
    }
    const collections = [
      workspace.accountGroups,
      workspace.assetAccounts,
      workspace.liabilityAccounts,
      workspace.allocationRules,
      workspace.incomeSources,
      workspace.incomeEvents,
      workspace.historicalIncome,
      workspace.expenseDefinitions,
      workspace.expenseEvents,
      workspace.debts,
      workspace.goals,
      workspace.sinkingFunds,
    ] as const;
    const seenIds = new Set<string>();
    for (const collection of collections) {
      for (const entity of collection) {
        if (entity.workspaceId !== workspace.id)
          context.addIssue({
            code: "custom",
            message: `Entity ${entity.id} belongs to another workspace.`,
          });
        if (seenIds.has(entity.id))
          context.addIssue({
            code: "custom",
            message: `Duplicate workspace entity ID: ${entity.id}.`,
          });
        seenIds.add(entity.id);
      }
    }
    const groupIds = new Set(workspace.accountGroups.map((group) => group.id));
    for (const account of [
      ...workspace.assetAccounts,
      ...workspace.liabilityAccounts,
    ]) {
      if (account.groupId !== undefined && !groupIds.has(account.groupId))
        context.addIssue({
          code: "custom",
          message: `Account ${account.id} references a missing account group.`,
        });
    }
    if (
      workspace.legacyV1Snapshot !== undefined &&
      workspace.legacyV1Snapshot.workspaceId !== workspace.id
    )
      context.addIssue({
        code: "custom",
        message: "Legacy snapshot belongs to another workspace.",
      });
  });
