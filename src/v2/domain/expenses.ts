import type { BudgetCategoryKey } from "./budget-categories";
import type { Recurrence, RecurrenceBounds } from "./recurrence";
import type {
  CalendarDate,
  EntityMetadata,
  ExpenseDefinitionId,
  ExpenseEventId,
  FinancialEntityId,
  FinancialEventStatus,
  ObligationClassification,
  PersonalProvenance,
  V2Cents,
  WorkspaceId,
} from "./types";
export type ExpenseNature = "fixed" | "variable" | "periodic" | "unexpected";
export type ExpenseDefinitionStatus = "active" | "paused" | "cancelled";
export const EXPENSE_TRANSACTION_TYPES = [
  "purchase",
  "person-payment",
  "refund",
  "transfer",
  "credit-card-payment",
  "savings-contribution",
] as const;
export type ExpenseTransactionType = (typeof EXPENSE_TRANSACTION_TYPES)[number];
export const PERSON_PAYMENT_PURPOSES = [
  "gift",
  "pay-someone",
  "other",
] as const;
export type PersonPaymentPurpose = (typeof PERSON_PAYMENT_PURPOSES)[number];
export type ExpenseDefinition = EntityMetadata &
  Readonly<{
    id: ExpenseDefinitionId;
    workspaceId: WorkspaceId;
    name: string;
    amountCents: V2Cents;
    category: BudgetCategoryKey;
    nature: ExpenseNature;
    obligation: ObligationClassification;
    /** Missing on older records means active. */
    status?: ExpenseDefinitionStatus;
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
    accountId?: FinancialEntityId;
    relatedAccountId?: FinancialEntityId;
    /** Portion of a debt payment known to reduce principal. Zero means unknown. */
    principalAmountCents?: V2Cents;
    transactionType?: ExpenseTransactionType;
    personPaymentPurpose?: PersonPaymentPurpose;
    note?: string;
    provenance: PersonalProvenance;
  }>;
