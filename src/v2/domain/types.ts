declare const brand: unique symbol;

export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
export type CalendarDate = Brand<string, "CalendarDate">;
export type V2Cents = Brand<number, "V2Cents">;
export type BasisPoints = Brand<number, "BasisPoints">;

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type AssetAccountId = Brand<string, "AssetAccountId">;
export type LiabilityAccountId = Brand<string, "LiabilityAccountId">;
export type AccountGroupId = Brand<string, "AccountGroupId">;
export type AllocationRuleId = Brand<string, "AllocationRuleId">;
export type IncomeSourceId = Brand<string, "IncomeSourceId">;
export type IncomeEventId = Brand<string, "IncomeEventId">;
export type HistoricalIncomeRecordId = Brand<
  string,
  "HistoricalIncomeRecordId"
>;
export type ExpenseDefinitionId = Brand<string, "ExpenseDefinitionId">;
export type ExpenseEventId = Brand<string, "ExpenseEventId">;
export type DebtId = Brand<string, "DebtId">;
export type GoalId = Brand<string, "GoalId">;
export type SinkingFundId = Brand<string, "SinkingFundId">;
export type FinancialEventId = Brand<string, "FinancialEventId">;
export type AllocationLinkId = Brand<string, "AllocationLinkId">;
export type BalanceCorrectionId = Brand<string, "BalanceCorrectionId">;

export type FinancialEntityId =
  | AssetAccountId
  | LiabilityAccountId
  | AccountGroupId
  | IncomeSourceId
  | IncomeEventId
  | ExpenseDefinitionId
  | ExpenseEventId
  | DebtId
  | GoalId
  | SinkingFundId
  | BalanceCorrectionId;

export type PersonalProvenance =
  "user-entered" | "synthetic-demo" | "legacy-v1" | "imported-local";
export type PublicDataProvenance = "official-public-data";
export type FinancialEventStatus = "expected" | "actual" | "cancelled";
export type ObligationClassification = "required" | "flexible" | "optional";

export type EntityMetadata = Readonly<{
  createdAt: string;
  updatedAt: string;
}>;

export function asEntityId<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}
