import { addCents, asV2Cents, subtractCents } from "./money";
import type {
  AssetAccountId,
  AccountGroupId,
  CalendarDate,
  EntityMetadata,
  LiabilityAccountId,
  PersonalProvenance,
  V2Cents,
  WorkspaceId,
} from "./types";

export const ASSET_ACCOUNT_TYPES = [
  "chequing",
  "savings",
  "cash",
  "prepaid",
  "tfsa",
  "rrsp",
  "fhsa",
  "non-registered-investment",
  "crypto",
  "other-asset",
] as const;
export type AssetAccountType = (typeof ASSET_ACCOUNT_TYPES)[number];

export const SPENDABILITY_TYPES = [
  "spendable",
  "restricted",
  "non-cash",
] as const;
export type Spendability = (typeof SPENDABILITY_TYPES)[number];
export type AccountStatus = "active" | "archived";

/** A manually maintained asset. It never contains bank credentials or account numbers. */
export type AssetAccount = EntityMetadata &
  Readonly<{
    id: AssetAccountId;
    groupId?: AccountGroupId;
    workspaceId: WorkspaceId;
    name: string;
    type: AssetAccountType;
    currentValueCents: V2Cents;
    valueAsOfDate: CalendarDate;
    spendability: Spendability;
    includeInNetWorth: boolean;
    status: AccountStatus;
    provenance: PersonalProvenance;
    institutionLabel?: string;
    note?: string;
  }>;

export const LIABILITY_ACCOUNT_TYPES = [
  "credit-card",
  "line-of-credit",
  "student-loan",
  "tuition-balance",
  "personal-loan",
  "auto-loan",
  "mortgage",
  "other-debt",
] as const;
export type LiabilityAccountType = (typeof LIABILITY_ACCOUNT_TYPES)[number];
export const DEBT_PAYMENT_REQUIREMENTS = ["required", "flexible"] as const;
export type DebtPaymentRequirement = (typeof DEBT_PAYMENT_REQUIREMENTS)[number];
export const DEBT_PAYMENT_FREQUENCIES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
] as const;
export type DebtPaymentFrequency = (typeof DEBT_PAYMENT_FREQUENCIES)[number];

/** A manually maintained debt. A negative balance represents an account credit. */
export type LiabilityAccount = EntityMetadata &
  Readonly<{
    id: LiabilityAccountId;
    groupId?: AccountGroupId;
    workspaceId: WorkspaceId;
    name: string;
    type: LiabilityAccountType;
    currentBalanceCents: V2Cents;
    paymentRequirement?: DebtPaymentRequirement;
    paymentFrequency?: DebtPaymentFrequency;
    requiredPaymentCents?: V2Cents;
    requiredMonthlyPaymentCents?: V2Cents;
    nextPaymentDate?: CalendarDate;
    targetPayoffDate?: CalendarDate;
    /** Retained only for older local backups. New records use full dates. */
    paymentDueDay?: number;
    balanceAsOfDate: CalendarDate;
    includeInNetWorth: boolean;
    status: AccountStatus;
    provenance: PersonalProvenance;
    institutionLabel?: string;
    note?: string;
  }>;

export function monthlyEquivalentDebtPayment(
  paymentCents: V2Cents,
  frequency: DebtPaymentFrequency,
): V2Cents {
  if (frequency === "weekly")
    return asV2Cents(Math.round((paymentCents * 52) / 12));
  if (frequency === "biweekly")
    return asV2Cents(Math.round((paymentCents * 26) / 12));
  if (frequency === "semimonthly") return asV2Cents(paymentCents * 2);
  return paymentCents;
}

const sum = (values: readonly V2Cents[]): V2Cents =>
  values.reduce((total, value) => addCents(total, value), asV2Cents(0));

export function deriveSpendableCashCents(
  accounts: readonly AssetAccount[],
): V2Cents {
  return sum(
    accounts
      .filter(
        (account) =>
          account.status === "active" && account.spendability === "spendable",
      )
      .map((account) => account.currentValueCents),
  );
}

/** Applies a manually recorded inflow or outflow to one asset balance. */
export function applyAssetAccountActivity(
  account: AssetAccount,
  direction: "inflow" | "outflow",
  amountCents: V2Cents,
  valueAsOfDate: CalendarDate,
  updatedAt: string,
): AssetAccount {
  if (amountCents < 0)
    throw new RangeError("Account activity amount must be non-negative.");
  return {
    ...account,
    currentValueCents:
      direction === "inflow"
        ? addCents(account.currentValueCents, amountCents)
        : subtractCents(account.currentValueCents, amountCents),
    valueAsOfDate,
    updatedAt,
  };
}

/** Applies a purchase, refund, or payment to a manually tracked debt balance. */
export function applyLiabilityAccountActivity(
  account: LiabilityAccount,
  direction: "increase" | "decrease",
  amountCents: V2Cents,
  balanceAsOfDate: CalendarDate,
  updatedAt: string,
): LiabilityAccount {
  if (amountCents < 0)
    throw new RangeError("Debt activity amount must be non-negative.");
  return {
    ...account,
    currentBalanceCents:
      direction === "increase"
        ? addCents(account.currentBalanceCents, amountCents)
        : subtractCents(account.currentBalanceCents, amountCents),
    balanceAsOfDate,
    updatedAt,
  };
}

export function deriveTotalAssetsCents(
  accounts: readonly AssetAccount[],
): V2Cents {
  return sum(
    accounts
      .filter(
        (account) => account.status === "active" && account.includeInNetWorth,
      )
      .map((account) => account.currentValueCents),
  );
}

export function deriveTotalLiabilitiesCents(
  accounts: readonly LiabilityAccount[],
): V2Cents {
  return sum(
    accounts
      .filter(
        (account) => account.status === "active" && account.includeInNetWorth,
      )
      .map((account) => asV2Cents(Math.max(0, account.currentBalanceCents))),
  );
}

export function deriveLiabilityCreditsCents(
  accounts: readonly LiabilityAccount[],
): V2Cents {
  return sum(
    accounts
      .filter(
        (account) => account.status === "active" && account.includeInNetWorth,
      )
      .map((account) =>
        account.currentBalanceCents < 0
          ? subtractCents(asV2Cents(0), account.currentBalanceCents)
          : asV2Cents(0),
      ),
  );
}

export function deriveTotalOwnedCents(
  assets: readonly AssetAccount[],
  liabilities: readonly LiabilityAccount[],
): V2Cents {
  return addCents(
    deriveTotalAssetsCents(assets),
    deriveLiabilityCreditsCents(liabilities),
  );
}

export function deriveRequiredDebtPayments(
  accounts: readonly LiabilityAccount[],
): Readonly<{
  totalCents: V2Cents;
  missingAccountIds: readonly LiabilityAccountId[];
}> {
  const active = accounts.filter(
    (account) => account.status === "active" && account.currentBalanceCents > 0,
  );
  return {
    totalCents: sum(
      active.flatMap((account) =>
        account.paymentRequirement === "flexible" ||
        account.requiredMonthlyPaymentCents === undefined
          ? []
          : [
              asV2Cents(
                Math.min(
                  account.requiredMonthlyPaymentCents,
                  account.currentBalanceCents,
                ),
              ),
            ],
      ),
    ),
    missingAccountIds: active
      .filter(
        (account) =>
          account.paymentRequirement === undefined &&
          account.requiredMonthlyPaymentCents === undefined &&
          account.type !== "credit-card" &&
          account.type !== "line-of-credit",
      )
      .map((account) => account.id),
  };
}

export function deriveNetWorthCents(
  assets: readonly AssetAccount[],
  liabilities: readonly LiabilityAccount[],
): V2Cents {
  return subtractCents(
    deriveTotalOwnedCents(assets, liabilities),
    deriveTotalLiabilitiesCents(liabilities),
  );
}

export const DEFAULT_STALE_ACCOUNT_DAYS = 14;

export function isAccountValueStale(
  valueAsOfDate: CalendarDate,
  today: CalendarDate,
  differenceInDays: (start: CalendarDate, end: CalendarDate) => number,
  staleAfterDays = DEFAULT_STALE_ACCOUNT_DAYS,
): boolean {
  return differenceInDays(valueAsOfDate, today) > staleAfterDays;
}
