import type { BudgetCategoryKey } from "./budget-categories";
import type { Recurrence, RecurrenceBounds } from "./recurrence";
import type {
  AssetAccountId,
  CalendarDate,
  EntityMetadata,
  ExpenseDefinitionId,
  ExpenseEventId,
  FinancialEventStatus,
  ObligationClassification,
  PersonalProvenance,
  V2Cents,
  WorkspaceId,
} from "./types";
export type ExpenseNature = "fixed" | "variable" | "periodic" | "unexpected";
export const EXPENSE_TRANSACTION_TYPES = [
  "purchase",
  "refund",
  "transfer",
  "credit-card-payment",
  "savings-contribution",
] as const;
export type ExpenseTransactionType = (typeof EXPENSE_TRANSACTION_TYPES)[number];
export type ExpenseDefinition = EntityMetadata &
  Readonly<{
    id: ExpenseDefinitionId;
    workspaceId: WorkspaceId;
    name: string;
    amountCents: V2Cents;
    category: BudgetCategoryKey;
    nature: ExpenseNature;
    obligation: ObligationClassification;
    recurrence: Recurrence;
    bounds: RecurrenceBounds;
    provenance: PersonalProvenance;
  }>;
export type DatedExpenseEvent = EntityMetadata &
  Readonly<{
    id: ExpenseEventId;
    workspaceId: WorkspaceId;
    definitionId?: ExpenseDefinitionId;
    name: string;
    amountCents: V2Cents;
    category: BudgetCategoryKey;
    nature: ExpenseNature;
    obligation: ObligationClassification;
    dueDate: CalendarDate;
    status: FinancialEventStatus;
    actualDate?: CalendarDate;
    accountId?: AssetAccountId;
    transactionType?: ExpenseTransactionType;
    provenance: PersonalProvenance;
  }>;
