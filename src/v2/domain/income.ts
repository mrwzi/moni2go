import type { Recurrence, RecurrenceBounds } from "./recurrence";
import type {
  CalendarDate,
  FinancialEntityId,
  EntityMetadata,
  FinancialEventStatus,
  HistoricalIncomeRecordId,
  IncomeEventId,
  IncomeSourceId,
  PersonalProvenance,
  V2Cents,
  WorkspaceId,
} from "./types";
export type IncomeSource = EntityMetadata &
  Readonly<{
    id: IncomeSourceId;
    workspaceId: WorkspaceId;
    name: string;
    defaultAmountCents?: V2Cents;
    recurrence: Recurrence;
    bounds: RecurrenceBounds;
    provenance: PersonalProvenance;
  }>;
export type HistoricalIncomeRecord = EntityMetadata &
  Readonly<{
    id: HistoricalIncomeRecordId;
    workspaceId: WorkspaceId;
    sourceId?: IncomeSourceId;
    /** Asset account that received this income, when it was recorded in-app. */
    accountId?: FinancialEntityId;
    name: string;
    amountCents: V2Cents;
    receivedDate: CalendarDate;
    provenance: PersonalProvenance;
  }>;
export type DatedIncomeEvent = EntityMetadata &
  Readonly<{
    id: IncomeEventId;
    workspaceId: WorkspaceId;
    sourceId?: IncomeSourceId;
    name: string;
    amountCents: V2Cents;
    expectedDate: CalendarDate;
    status: FinancialEventStatus;
    actualDate?: CalendarDate;
    provenance: PersonalProvenance;
  }>;
