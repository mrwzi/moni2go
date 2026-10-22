import type { Debt } from "./debts";
import type { AssetAccount, LiabilityAccount } from "./accounts";
import type { AccountGroup } from "./account-groups";
import type { AllocationRule, ReminderPreferences } from "./planning";
import type { ExpenseDefinition, DatedExpenseEvent } from "./expenses";
import type { FinancialGoal } from "./goals";
import type {
  HistoricalIncomeRecord,
  IncomeSource,
  DatedIncomeEvent,
} from "./income";
import type { LegacyV1BaselineSnapshot } from "./legacy";
import type { SinkingFund } from "./sinking-funds";
import type { BalanceCorrection } from "./balance-corrections";
import type {
  CalendarDate,
  EntityMetadata,
  PersonalProvenance,
  WorkspaceId,
} from "./types";
export const V2_WORKSPACE_SCHEMA_VERSION = 2;
export const CANADIAN_REGION_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;
export type CanadianRegionCode = (typeof CANADIAN_REGION_CODES)[number];
export type UserContext = Readonly<{
  country: "CA";
  provinceOrTerritory?: CanadianRegionCode;
  populationCentre?: Readonly<{ code: string; label: string }>;
  preferences: Readonly<{
    firstDayOfWeek: "monday" | "sunday";
    upcomingWindowDays: number;
    reminders: ReminderPreferences;
  }>;
}>;
export type FinancialWorkspace = EntityMetadata &
  Readonly<{
    schemaVersion: 2;
    id: WorkspaceId;
    name: string;
    provenance: PersonalProvenance;
    currency: "CAD";
    asOfDate: CalendarDate;
    timeZone: string;
    accountGroups: readonly AccountGroup[];
    assetAccounts: readonly AssetAccount[];
    liabilityAccounts: readonly LiabilityAccount[];
    allocationRules: readonly AllocationRule[];
    incomeSources: readonly IncomeSource[];
    incomeEvents: readonly DatedIncomeEvent[];
    historicalIncome: readonly HistoricalIncomeRecord[];
    expenseDefinitions: readonly ExpenseDefinition[];
    expenseEvents: readonly DatedExpenseEvent[];
    debts: readonly Debt[];
    goals: readonly FinancialGoal[];
    sinkingFunds: readonly SinkingFund[];
    balanceCorrections?: readonly BalanceCorrection[];
    context: UserContext;
    legacyV1Snapshot?: LegacyV1BaselineSnapshot;
  }>;
