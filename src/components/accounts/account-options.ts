import type { AccountGroupType } from "../../v2/domain/account-groups";
import type {
  AssetAccountType,
  LiabilityAccountType,
} from "../../v2/domain/accounts";
import type { BudgetCategoryKey } from "../../v2/domain/budget-categories";

export const accountLabels: Record<
  AssetAccountType | LiabilityAccountType,
  string
> = {
  chequing: "Chequing",
  savings: "Savings",
  cash: "Cash",
  prepaid: "Prepaid",
  tfsa: "TFSA",
  rrsp: "RRSP",
  fhsa: "FHSA",
  crypto: "Crypto",
  "non-registered-investment": "Investment",
  "other-asset": "Other asset",
  "credit-card": "Credit card",
  "line-of-credit": "Line of credit",
  "student-loan": "Student loan",
  "tuition-balance": "Tuition owed to a school",
  "personal-loan": "Personal loan",
  "auto-loan": "Auto loan",
  mortgage: "Mortgage",
  "other-debt": "Other debt",
};

export const groupLabels: Record<AccountGroupType, string> = {
  bank: "Bank",
  "credit-union": "Credit union",
  "online-bank": "Online bank",
  "investment-platform": "Investment platform",
  "crypto-platform": "Crypto exchange or wallet",
  "education-provider": "University or college",
  cash: "Cash",
  other: "Other",
};

export const INCOME_LABELS = [
  "Paycheque",
  "Benefits",
  "Gift",
  "Government payment",
  "Other income",
] as const;
export type IncomeLabel = (typeof INCOME_LABELS)[number];

export const SPENDING_CATEGORIES = [
  "housing",
  "utilities",
  "phone-internet",
  "insurance",
  "groceries",
  "restaurants",
  "transportation",
  "clothing",
  "shopping",
  "entertainment-recreation",
  "subscriptions",
  "health-personal-care",
  "debt-payments",
  "savings-goals",
  "other",
] as const satisfies readonly BudgetCategoryKey[];
