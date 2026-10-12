import { describe, expect, it } from "vitest";
import {
  applyAssetAccountActivity,
  deriveRequiredDebtPayments,
  DEFAULT_STALE_ACCOUNT_DAYS,
  deriveNetWorthCents,
  deriveSpendableCashCents,
  deriveTotalAssetsCents,
  deriveTotalLiabilitiesCents,
  isAccountValueStale,
  monthlyEquivalentDebtPayment,
  type AssetAccount,
  type LiabilityAccount,
} from "../../../src/v2/domain/accounts";
import {
  differenceInCalendarDays,
  parseCalendarDate,
} from "../../../src/v2/domain/calendar";
import {
  accountGroupSchema,
  assetAccountSchema,
  liabilityAccountSchema,
} from "../../../src/v2/domain/schemas";

const now = "2026-09-25T12:00:00.000Z";
const asset = {
  id: "asset-1",
  workspaceId: "workspace-1",
  name: "Everyday chequing",
  type: "chequing",
  currentValueCents: 142_000,
  valueAsOfDate: "2026-09-25",
  spendability: "spendable",
  includeInNetWorth: true,
  status: "active",
  provenance: "user-entered",
  createdAt: now,
  updatedAt: now,
} as const;
const liability = {
  id: "liability-1",
  workspaceId: "workspace-1",
  name: "Credit card",
  type: "credit-card",
  currentBalanceCents: 42_000,
  balanceAsOfDate: "2026-09-25",
  includeInNetWorth: true,
  status: "active",
  provenance: "user-entered",
  createdAt: now,
  updatedAt: now,
} as const;

function typedAsset(overrides: Record<string, unknown> = {}): AssetAccount {
  const value = { ...asset, ...overrides };
  return assetAccountSchema.parse(value) as unknown as AssetAccount;
}

function typedLiability(
  overrides: Record<string, unknown> = {},
): LiabilityAccount {
  const value = { ...liability, ...overrides };
  return liabilityAccountSchema.parse(value) as unknown as LiabilityAccount;
}

describe("manual financial accounts", () => {
  it("validates supported asset and liability records", () => {
    expect(assetAccountSchema.parse(asset)).toEqual(asset);
    expect(liabilityAccountSchema.parse(liability)).toEqual(liability);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        type: "tuition-balance",
      }).success,
    ).toBe(true);
    expect(
      accountGroupSchema.safeParse({
        id: "school-1",
        workspaceId: "workspace-1",
        name: "Example University",
        type: "education-provider",
        status: "active",
        provenance: "user-entered",
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(true);
  });

  it("totals known required debt payments and reports missing ones", () => {
    const known = typedLiability({
      id: "liability-known",
      paymentRequirement: "required",
      requiredMonthlyPaymentCents: 12_345,
    });
    const missing = typedLiability({
      id: "liability-missing",
      type: "personal-loan",
    });
    expect(deriveRequiredDebtPayments([known, missing])).toEqual({
      totalCents: 12_345,
      missingAccountIds: ["liability-missing"],
    });
    expect(
      deriveRequiredDebtPayments([
        typedLiability({ id: "paid-off", currentBalanceCents: 0 }),
      ]),
    ).toEqual({ totalCents: 0, missingAccountIds: [] });
    expect(
      deriveRequiredDebtPayments([
        typedLiability({
          id: "flexible-debt",
          paymentRequirement: "flexible",
        }),
      ]),
    ).toEqual({ totalCents: 0, missingAccountIds: [] });
    expect(
      deriveRequiredDebtPayments([
        typedLiability({
          id: "card-without-statement",
          type: "credit-card",
          paymentRequirement: undefined,
        }),
      ]),
    ).toEqual({ totalCents: 0, missingAccountIds: [] });
  });

  it("keeps fixed and flexible debt-payment contracts distinct", () => {
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        paymentRequirement: "required",
      }).success,
    ).toBe(false);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        currentBalanceCents: 0,
        paymentRequirement: "required",
      }).success,
    ).toBe(true);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        paymentRequirement: "flexible",
      }).success,
    ).toBe(true);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        paymentRequirement: "flexible",
        requiredMonthlyPaymentCents: 10,
      }).success,
    ).toBe(false);
  });

  it("normalizes scheduled debt installments to a monthly plan amount", () => {
    expect(monthlyEquivalentDebtPayment(10_000 as never, "monthly")).toBe(
      10_000,
    );
    expect(monthlyEquivalentDebtPayment(10_000 as never, "semimonthly")).toBe(
      20_000,
    );
    expect(monthlyEquivalentDebtPayment(10_000 as never, "biweekly")).toBe(
      21_667,
    );
    expect(monthlyEquivalentDebtPayment(10_000 as never, "weekly")).toBe(
      43_333,
    );
  });

  it("validates modern debt schedules and flexible payoff targets", () => {
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        paymentRequirement: "required",
        requiredPaymentCents: 10_000,
        requiredMonthlyPaymentCents: 21_667,
        paymentFrequency: "biweekly",
        nextPaymentDate: "2026-10-30",
      }).success,
    ).toBe(true);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        paymentRequirement: "flexible",
        targetPayoffDate: "2027-10-31",
      }).success,
    ).toBe(true);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        paymentRequirement: "required",
        requiredPaymentCents: 10_000,
        requiredMonthlyPaymentCents: 10_000,
      }).success,
    ).toBe(false);
  });

  it("validates a bank as a group rather than an account balance", () => {
    expect(
      accountGroupSchema.parse({
        id: "bank-1",
        workspaceId: "workspace-1",
        name: "Example Bank",
        type: "bank",
        status: "active",
        provenance: "user-entered",
        createdAt: now,
        updatedAt: now,
      }),
    ).toMatchObject({ name: "Example Bank", type: "bank" });
  });

  it("keeps investments in assets but out of spendable cash", () => {
    const accounts = [
      typedAsset(),
      typedAsset({
        id: "asset-2",
        type: "tfsa",
        spendability: "non-cash",
        currentValueCents: 500_000,
      }),
    ];
    expect(deriveSpendableCashCents(accounts)).toBe(142_000);
    expect(deriveTotalAssetsCents(accounts)).toBe(642_000);
  });

  it("applies manual money-in and money-out activity in exact cents", () => {
    const account = typedAsset();
    const afterIncome = applyAssetAccountActivity(
      account,
      "inflow",
      12_345 as never,
      parseCalendarDate("2026-10-05"),
      "2026-10-05T12:00:00.000Z",
    );
    const afterSpending = applyAssetAccountActivity(
      afterIncome,
      "outflow",
      2_345 as never,
      parseCalendarDate("2026-10-05"),
      "2026-10-05T12:01:00.000Z",
    );
    expect(afterIncome.currentValueCents).toBe(154_345);
    expect(afterSpending.currentValueCents).toBe(152_000);
    expect(account.currentValueCents).toBe(142_000);
  });

  it("excludes archived and opted-out records from totals", () => {
    expect(deriveTotalAssetsCents([typedAsset({ status: "archived" })])).toBe(
      0,
    );
    expect(
      deriveTotalLiabilitiesCents([
        typedLiability({ includeInNetWorth: false }),
      ]),
    ).toBe(0);
  });

  it("derives net worth without persisting another total", () => {
    expect(deriveNetWorthCents([typedAsset()], [typedLiability()])).toBe(
      100_000,
    );
  });

  it("supports an overdrawn deposit asset but rejects a negative liability", () => {
    expect(
      assetAccountSchema.safeParse({ ...asset, currentValueCents: -5_000 })
        .success,
    ).toBe(true);
    expect(
      liabilityAccountSchema.safeParse({
        ...liability,
        currentBalanceCents: -1,
      }).success,
    ).toBe(false);
  });

  it("does not admit credit types or credential fields as assets", () => {
    expect(
      assetAccountSchema.safeParse({ ...asset, type: "credit-card" }).success,
    ).toBe(false);
    expect(
      assetAccountSchema.safeParse({ ...asset, accountNumber: "123" }).success,
    ).toBe(false);
  });

  it("uses a deterministic configurable freshness threshold", () => {
    const start = parseCalendarDate("2026-09-01");
    expect(DEFAULT_STALE_ACCOUNT_DAYS).toBe(14);
    expect(
      isAccountValueStale(
        start,
        parseCalendarDate("2026-09-15"),
        differenceInCalendarDays,
      ),
    ).toBe(false);
    expect(
      isAccountValueStale(
        start,
        parseCalendarDate("2026-09-16"),
        differenceInCalendarDays,
      ),
    ).toBe(true);
  });
});
