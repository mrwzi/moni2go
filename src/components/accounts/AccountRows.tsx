import { formatCad } from "../../domain/money";
import type { AssetAccount, LiabilityAccount } from "../../v2/domain/accounts";
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
          <div className="account-row-value">
            <strong>{formatCad(account.currentBalanceCents)}</strong>
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
  if (account.currentBalanceCents === 0) return "No balance owed";
  if (account.requiredMonthlyPaymentCents !== undefined)
    return `${formatCad(account.requiredMonthlyPaymentCents)} / month${account.paymentDueDay ? ` · due day ${account.paymentDueDay.toString()}` : ""}`;
  return account.paymentRequirement === "flexible"
    ? "No fixed monthly payment"
    : "Monthly payment missing";
}
