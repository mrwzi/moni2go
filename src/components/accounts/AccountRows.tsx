import { formatCad } from "../../domain/money";
import type {
  AssetAccount,
  DebtPaymentFrequency,
  LiabilityAccount,
} from "../../v2/domain/accounts";
import { calendarDateParts } from "../../v2/domain/calendar";
import type { CalendarDate } from "../../v2/domain/types";
import { accountLabels } from "./account-options";
import { ActionMenu } from "./ActionMenu";

export function AccountRows({
  assets,
  liabilities,
  onRemove,
  onUpdateAsset,
  onEditLiability,
}: Readonly<{
  assets: readonly AssetAccount[];
  liabilities: readonly LiabilityAccount[];
  onRemove: (id: string, kind: "asset" | "liability") => Promise<void>;
  onUpdateAsset: (account: AssetAccount) => void;
  onEditLiability: (account: LiabilityAccount) => void;
}>) {
  if (assets.length + liabilities.length === 0)
    return <p className="empty-group-copy">No accounts here yet.</p>;

  return (
    <ul className="account-list">
      {assets.map((account) => (
        <li key={account.id}>
          <div className="account-row-copy">
            <strong>{account.name}</strong>
            <span>{accountLabels[account.type]}</span>
          </div>
          <div className="account-row-value">
            <strong>{formatCad(account.currentValueCents)}</strong>
          </div>
          <ActionMenu
            label={`More actions for ${account.name}`}
            title={`${account.name} account`}
            primaryActionLabel="Update balance"
            onPrimaryAction={() => {
              onUpdateAsset(account);
            }}
            actionLabel="Remove account"
            onAction={() => void onRemove(account.id, "asset")}
          />
        </li>
      ))}
      {liabilities.map((account) => (
        <li key={account.id}>
          <div className="account-row-copy">
            <strong>{account.name}</strong>
            <span>{accountLabels[account.type]}</span>
          </div>
          <div
            className={`account-row-value${account.currentBalanceCents > 0 ? " account-row-debt" : account.currentBalanceCents < 0 ? " account-row-credit" : ""}`}
          >
            <strong>
              {account.currentBalanceCents > 0
                ? `Owed ${formatCad(account.currentBalanceCents)}`
                : account.currentBalanceCents < 0
                  ? `Credit ${formatCad(Math.abs(account.currentBalanceCents))}`
                  : formatCad(0)}
            </strong>
            <span>{debtPaymentLabel(account)}</span>
          </div>
          <ActionMenu
            label={`More actions for ${account.name}`}
            title={`${account.name} account`}
            primaryActionLabel="Update debt details"
            onPrimaryAction={() => {
              onEditLiability(account);
            }}
            actionLabel="Remove account"
            onAction={() => void onRemove(account.id, "liability")}
          />
        </li>
      ))}
    </ul>
  );
}

function debtPaymentLabel(account: LiabilityAccount): string {
  if (account.currentBalanceCents < 0)
    return "Credit available on this account";
  if (account.currentBalanceCents === 0) return "No balance owed";
  if (
    account.requiredPaymentCents !== undefined &&
    account.paymentFrequency !== undefined
  ) {
    const nextDate = account.nextPaymentDate
      ? ` · next ${formatShortDate(account.nextPaymentDate)}`
      : "";
    return `${formatCad(account.requiredPaymentCents)} ${frequencyLabel(account.paymentFrequency)}${nextDate}`;
  }
  if (account.requiredMonthlyPaymentCents !== undefined)
    return `${formatCad(account.requiredMonthlyPaymentCents)} every month${account.paymentDueDay ? ` · day ${account.paymentDueDay.toString()}` : ""}`;
  if (account.targetPayoffDate)
    return `Target ${formatShortDate(account.targetPayoffDate)}`;
  if (account.type === "credit-card" || account.type === "line-of-credit")
    return "No payment due recorded";
  return account.paymentRequirement === "flexible"
    ? "No fixed payment"
    : "Monthly payment missing";
}

function frequencyLabel(frequency: DebtPaymentFrequency): string {
  if (frequency === "weekly") return "every week";
  if (frequency === "biweekly") return "every 2 weeks";
  if (frequency === "semimonthly") return "twice a month";
  return "every month";
}

function formatShortDate(date: CalendarDate): string {
  const { year, month, day } = calendarDateParts(date);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
