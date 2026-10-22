import { compareCalendarDates } from "./calendar";
import type {
  AssetAccountId,
  BalanceCorrectionId,
  CalendarDate,
  EntityMetadata,
  FinancialEntityId,
  LiabilityAccountId,
  PersonalProvenance,
  V2Cents,
  WorkspaceId,
} from "./types";

export type BalanceCorrection = EntityMetadata &
  Readonly<{
    id: BalanceCorrectionId;
    workspaceId: WorkspaceId;
    accountId: AssetAccountId | LiabilityAccountId;
    correctionDate: CalendarDate;
    previousBalanceCents: V2Cents;
    correctedBalanceCents: V2Cents;
    provenance: PersonalProvenance;
  }>;

export function hasBalanceCorrectionAfterActivity(
  corrections: readonly BalanceCorrection[] | undefined,
  accountIds: readonly FinancialEntityId[],
  activityDate: CalendarDate,
  activityUpdatedAt: string,
): boolean {
  if (!corrections?.length || accountIds.length === 0) return false;
  const affected = new Set<string>(accountIds);
  return corrections.some(
    (correction) =>
      affected.has(correction.accountId) &&
      (compareCalendarDates(correction.correctionDate, activityDate) > 0 ||
        (correction.correctionDate === activityDate &&
          correction.createdAt > activityUpdatedAt)),
  );
}
