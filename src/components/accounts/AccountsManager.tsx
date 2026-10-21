"use client";

import { useEffect, useRef, useState } from "react";
import { formatCad } from "../../domain/money";
import {
  type AccountGroup,
  type AccountGroupType,
} from "../../v2/domain/account-groups";
import {
  ASSET_ACCOUNT_TYPES,
  DEBT_PAYMENT_FREQUENCIES,
  LIABILITY_ACCOUNT_TYPES,
  applyAssetAccountActivity,
  applyLiabilityAccountActivity,
  deriveNetWorthCents,
  deriveSpendableCashCents,
  deriveTotalOwnedCents,
  deriveTotalLiabilitiesCents,
  monthlyEquivalentDebtPayment,
  type AssetAccount,
  type AssetAccountType,
  type DebtPaymentRequirement,
  type DebtPaymentFrequency,
  type LiabilityAccount,
  type LiabilityAccountType,
  type Spendability,
} from "../../v2/domain/accounts";
import { BUDGET_CATEGORIES } from "../../v2/domain/budget-categories";
import { parseCalendarDate } from "../../v2/domain/calendar";
import { classifyObligations } from "../../v2/domain/financial-insights";
import { MAX_V2_CENTS, asV2Cents } from "../../v2/domain/money";
import type {
  AccountGroupId,
  AssetAccountId,
  ExpenseEventId,
  HistoricalIncomeRecordId,
  LiabilityAccountId,
} from "../../v2/domain/types";
import { useFinancialWorkspace } from "../../v2/react/useFinancialWorkspace";
import { LoadingState } from "../shared/LoadingState";
import { AccountRows } from "./AccountRows";
import { CommitmentsManager } from "./CommitmentsManager";
import { ActionMenu } from "./ActionMenu";
import {
  AccountBalanceDialog,
  BALANCE_UPDATE_REASONS,
  type BalanceUpdateInput,
} from "./AccountBalanceDialog";
import { accountLabels, groupLabels } from "./account-options";
import {
  QuickActivityDialog,
  type QuickActivityInput,
  type QuickActivityKind,
} from "./QuickActivityDialog";
import { TransactionHistory } from "./TransactionHistory";

function parseMoney(value: string, allowNegative: boolean): number | null {
  const normalized = value.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith("-");
  if (negative && !allowNegative) return null;
  const [whole = "0", fraction = ""] = normalized.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  const signed = negative ? -cents : cents;
  return Number.isSafeInteger(signed) && Math.abs(signed) <= MAX_V2_CENTS
    ? signed
    : null;
}

const PROVIDER_TYPE_OPTIONS = [
  "bank",
  "investment-platform",
  "crypto-platform",
  "education-provider",
  "cash",
  "other",
] as const satisfies readonly AccountGroupType[];

const paymentFrequencyLabels: Record<DebtPaymentFrequency, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Every month",
};

function providerNameLabel(type: AccountGroupType): string {
  if (type === "bank") return "Bank name";
  if (type === "investment-platform") return "Investment platform name";
  if (type === "crypto-platform") return "Crypto exchange or wallet name";
  if (type === "education-provider") return "Name of university or college";
  return "Provider or place name";
}

function providerPlaceholder(type: AccountGroupType): string {
  if (type === "bank") return "For example, BMO, TD, or Bank of America";
  if (type === "investment-platform")
    return "For example, Wealthsimple, Questrade, or Fidelity";
  if (type === "crypto-platform")
    return "For example, MEXC, Coinbase, or Tangem";
  if (type === "education-provider")
    return "For example, University of Waterloo";
  return "Enter the name you recognize";
}

function providerHelp(type: AccountGroupType): string | null {
  if (type === "bank")
    return "Add the bank first. Next, add each chequing, savings, or credit-card account inside it.";
  if (type === "investment-platform")
    return "Add the platform first. Next, add TFSA, RRSP, FHSA, or investment accounts inside it.";
  if (type === "crypto-platform")
    return "Add the exchange or wallet first. Next, add the crypto account held inside it.";
  if (type === "education-provider")
    return "Add the school first. Next, add a student loan or tuition balance associated with it.";
  return null;
}

function localToday() {
  const date = new Date();
  return parseCalendarDate(
    `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  );
}

function applyCreditActivity(
  account: LiabilityAccount,
  direction: "increase" | "decrease",
  amountCents: ReturnType<typeof asV2Cents>,
  balanceAsOfDate: ReturnType<typeof localToday>,
  updatedAt: string,
): LiabilityAccount {
  const updated = applyLiabilityAccountActivity(
    account,
    direction,
    amountCents,
    balanceAsOfDate,
    updatedAt,
  );
  if (
    updated.currentBalanceCents > 0 &&
    updated.paymentRequirement === "required" &&
    updated.requiredMonthlyPaymentCents === undefined
  ) {
    const normalized = { ...updated };
    delete normalized.paymentRequirement;
    return normalized;
  }
  return updated;
}

export function AccountsManager() {
  const { workspace, loading, error, save, ensureWorkspace } =
    useFinancialWorkspace();
  const [initialWorkspace] = useState(() => ensureWorkspace());
  const activeWorkspace = workspace ?? initialWorkspace;
  const [dialogGroupId, setDialogGroupId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<"asset" | "liability">("asset");
  const [newGroupType, setNewGroupType] = useState<AccountGroupType>("bank");
  const [newGroupName, setNewGroupName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [assetType, setAssetType] = useState<AssetAccountType>("chequing");
  const [liabilityType, setLiabilityType] =
    useState<LiabilityAccountType>("credit-card");
  const [valueInput, setValueInput] = useState("");
  const [monthlyPaymentInput, setMonthlyPaymentInput] = useState("");
  const [paymentFrequency, setPaymentFrequency] =
    useState<DebtPaymentFrequency>("monthly");
  const [nextPaymentDateInput, setNextPaymentDateInput] = useState("");
  const [targetPayoffDateInput, setTargetPayoffDateInput] = useState("");
  const [paymentRequirement, setPaymentRequirement] =
    useState<DebtPaymentRequirement>("required");
  const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(
    null,
  );
  const [spendability, setSpendability] = useState<Spendability>("spendable");
  const [message, setMessage] = useState<string | null>(null);
  const [activityKind, setActivityKind] = useState<QuickActivityKind | null>(
    null,
  );
  const [balanceUpdateAssetId, setBalanceUpdateAssetId] = useState<
    string | null
  >(null);
  const handledDebtEditIntent = useRef(false);
  const assets = workspace?.assetAccounts ?? [];
  const liabilities = workspace?.liabilityAccounts ?? [];
  const groups = workspace?.accountGroups ?? [];
  const dialogOpen = dialogGroupId !== null;
  const activeAssets = assets.filter((account) => account.status === "active");
  const balanceUpdateAccount = assets.find(
    (account) => account.id === balanceUpdateAssetId,
  );
  const hasZeroLiabilityBalance =
    kind === "liability" && parseMoney(valueInput, false) === 0;
  const selectedGroupType =
    dialogGroupId === "new"
      ? newGroupType
      : groups.find((group) => group.id === dialogGroupId)?.type;
  const isEducationPlace = selectedGroupType === "education-provider";

  function openActivity(kind: QuickActivityKind) {
    const hasCreditAccount = liabilities.some(
      (account) =>
        account.status === "active" &&
        (account.type === "credit-card" || account.type === "line-of-credit"),
    );
    if (
      (kind === "income" && activeAssets.length === 0) ||
      (kind === "expense" && activeAssets.length === 0 && !hasCreditAccount) ||
      (kind === "move" && activeAssets.length === 0)
    ) {
      setMessage("Add an account before recording money in or money out.");
      return;
    }
    setActivityKind(kind);
    setMessage(null);
  }

  function prepareAccountForProvider(type: AccountGroupType | undefined) {
    if (type === "education-provider") {
      setKind("liability");
      setLiabilityType("student-loan");
    } else if (type === "crypto-platform") {
      setKind("asset");
      setAssetType("crypto");
    } else if (type === "investment-platform") {
      setKind("asset");
      setAssetType("tfsa");
    } else if (type === "bank") {
      setKind("asset");
      setAssetType("chequing");
    }
  }

  function openDialog(groupId = "new") {
    setDialogGroupId(groupId);
    setStep(groupId === "new" ? 1 : 2);
    setKind("asset");
    setNewGroupType("bank");
    setNewGroupName("");
    setAccountName("");
    setAssetType("chequing");
    setLiabilityType("credit-card");
    setValueInput("");
    setMonthlyPaymentInput("");
    setPaymentFrequency("monthly");
    setNextPaymentDateInput("");
    setTargetPayoffDateInput("");
    setPaymentRequirement("required");
    setEditingLiabilityId(null);
    setSpendability("spendable");
    setMessage(null);
  }

  function editLiability(account: LiabilityAccount) {
    setDialogGroupId(account.groupId ?? "editing-ungrouped");
    setStep(3);
    setKind("liability");
    setAccountName(account.name);
    setLiabilityType(account.type);
    setValueInput((account.currentBalanceCents / 100).toFixed(2));
    setMonthlyPaymentInput(
      account.requiredPaymentCents === undefined &&
        account.requiredMonthlyPaymentCents === undefined
        ? ""
        : (
            (account.requiredPaymentCents ??
              account.requiredMonthlyPaymentCents ??
              0) / 100
          ).toFixed(2),
    );
    setPaymentFrequency(account.paymentFrequency ?? "monthly");
    setNextPaymentDateInput(account.nextPaymentDate ?? "");
    setTargetPayoffDateInput(account.targetPayoffDate ?? "");
    setPaymentRequirement(
      account.paymentRequirement ??
        (account.type === "credit-card" || account.type === "line-of-credit"
          ? "flexible"
          : "required"),
    );
    setEditingLiabilityId(account.id);
    setMessage(null);
  }

  useEffect(() => {
    if (!workspace || handledDebtEditIntent.current) return;
    const debtId =
      sessionStorage.getItem("moni2go-edit-debt") ??
      sessionStorage.getItem("northcents-edit-debt");
    if (!debtId) return;
    handledDebtEditIntent.current = true;
    sessionStorage.removeItem("moni2go-edit-debt");
    sessionStorage.removeItem("northcents-edit-debt");
    const account = workspace.liabilityAccounts.find(
      (liability) => liability.id === debtId,
    );
    if (account) editLiability(account);
  }, [workspace]);

  function continueFlow() {
    if (
      step === 1 &&
      dialogGroupId === "new" &&
      newGroupType !== "cash" &&
      !newGroupName.trim()
    ) {
      setMessage("Enter the bank or platform name.");
      return;
    }
    setMessage(null);
    if (step === 1 && dialogGroupId === "new" && newGroupType === "cash") {
      setKind("asset");
      setAssetType("cash");
      setAccountName("");
      setSpendability("spendable");
      setStep(3);
      return;
    }
    if (step === 1) prepareAccountForProvider(selectedGroupType);
    setStep((step + 1) as 2 | 3);
  }

  async function submit() {
    const selectedType = kind === "asset" ? assetType : liabilityType;
    const name = accountName.trim() || accountLabels[selectedType];
    const value = parseMoney(valueInput, kind === "asset");
    const needsMonthlyPayment =
      kind === "liability" &&
      paymentRequirement === "required" &&
      value !== null &&
      value > 0;
    const monthlyPayment = needsMonthlyPayment
      ? parseMoney(monthlyPaymentInput, false)
      : 0;
    let nextPaymentDate;
    let targetPayoffDate;
    try {
      nextPaymentDate = nextPaymentDateInput
        ? parseCalendarDate(nextPaymentDateInput)
        : undefined;
      targetPayoffDate = targetPayoffDateInput
        ? parseCalendarDate(targetPayoffDateInput)
        : undefined;
    } catch {
      setMessage("Choose a valid payment or target date.");
      return;
    }
    const selectedGroupId = dialogGroupId ?? "new";
    const placeName =
      selectedGroupId === "new" && newGroupType === "cash"
        ? "Cash"
        : newGroupName.trim();
    if (
      value === null ||
      (needsMonthlyPayment && monthlyPayment === null) ||
      (selectedGroupId === "new" && !placeName)
    ) {
      setMessage(
        needsMonthlyPayment
          ? "Enter the current balance and required payment amount."
          : kind === "liability"
            ? "Enter the current amount owed."
            : "Complete the place and enter the CAD value.",
      );
      return;
    }
    if (
      needsMonthlyPayment &&
      monthlyPayment !== null &&
      !editingLiabilityId &&
      monthlyPayment > value
    ) {
      setMessage(
        "The required payment cannot be more than the current amount owed.",
      );
      return;
    }
    const effectivePayment: number = needsMonthlyPayment
      ? editingLiabilityId
        ? Math.min(monthlyPayment ?? 0, value)
        : (monthlyPayment ?? 0)
      : 0;

    const current = activeWorkspace;
    const now = new Date().toISOString();
    if (editingLiabilityId) {
      const next = {
        ...current,
        updatedAt: now,
        asOfDate: localToday(),
        liabilityAccounts: current.liabilityAccounts.map((account) => {
          if (account.id !== editingLiabilityId) return account;
          const withoutPayment = { ...account };
          delete withoutPayment.requiredMonthlyPaymentCents;
          delete withoutPayment.requiredPaymentCents;
          delete withoutPayment.paymentFrequency;
          delete withoutPayment.nextPaymentDate;
          delete withoutPayment.targetPayoffDate;
          delete withoutPayment.paymentDueDay;
          return {
            ...withoutPayment,
            name,
            type: liabilityType,
            currentBalanceCents: asV2Cents(value),
            paymentRequirement,
            ...(needsMonthlyPayment
              ? {
                  requiredPaymentCents: asV2Cents(effectivePayment),
                  requiredMonthlyPaymentCents: monthlyEquivalentDebtPayment(
                    asV2Cents(effectivePayment),
                    paymentFrequency,
                  ),
                  paymentFrequency,
                  ...(nextPaymentDate ? { nextPaymentDate } : {}),
                }
              : targetPayoffDate
                ? { targetPayoffDate }
                : {}),
            balanceAsOfDate: localToday(),
            updatedAt: now,
          } satisfies LiabilityAccount;
        }),
      };
      try {
        await save(next);
        setDialogGroupId(null);
        setEditingLiabilityId(null);
        setMessage(
          monthlyPayment !== null && monthlyPayment > value
            ? `Debt updated to ${formatCad(asV2Cents(value))}. The required payment was adjusted to the remaining balance.`
            : `Debt updated to ${formatCad(asV2Cents(value))}.`,
        );
      } catch {
        setMessage(
          "The debt could not be updated. Your existing data was not changed.",
        );
      }
      return;
    }
    let groupId = selectedGroupId;
    const accountGroups = [...current.accountGroups];
    if (selectedGroupId === "new") {
      groupId = crypto.randomUUID();
      accountGroups.push({
        id: groupId as AccountGroupId,
        workspaceId: current.id,
        name: placeName,
        type: newGroupType,
        status: "active",
        provenance: "user-entered",
        createdAt: now,
        updatedAt: now,
      } satisfies AccountGroup);
    }

    const shared = {
      workspaceId: current.id,
      groupId: groupId as AccountGroupId,
      name,
      provenance: "user-entered" as const,
      status: "active" as const,
      includeInNetWorth: true,
      createdAt: now,
      updatedAt: now,
    };
    const next =
      kind === "asset"
        ? {
            ...current,
            updatedAt: now,
            asOfDate: localToday(),
            accountGroups,
            assetAccounts: [
              ...current.assetAccounts,
              {
                ...shared,
                id: crypto.randomUUID() as AssetAccountId,
                type: assetType,
                currentValueCents: asV2Cents(value),
                valueAsOfDate: localToday(),
                spendability,
              } satisfies AssetAccount,
            ],
          }
        : {
            ...current,
            updatedAt: now,
            asOfDate: localToday(),
            accountGroups,
            liabilityAccounts: [
              ...current.liabilityAccounts,
              {
                ...shared,
                id: crypto.randomUUID() as LiabilityAccountId,
                type: liabilityType,
                currentBalanceCents: asV2Cents(value),
                ...(value > 0 ? { paymentRequirement } : {}),
                ...(needsMonthlyPayment
                  ? {
                      requiredPaymentCents: asV2Cents(monthlyPayment ?? 0),
                      requiredMonthlyPaymentCents: monthlyEquivalentDebtPayment(
                        asV2Cents(monthlyPayment ?? 0),
                        paymentFrequency,
                      ),
                      paymentFrequency,
                      ...(nextPaymentDate ? { nextPaymentDate } : {}),
                    }
                  : targetPayoffDate
                    ? {
                        targetPayoffDate,
                      }
                    : {}),
                balanceAsOfDate: localToday(),
              } satisfies LiabilityAccount,
            ],
          };

    try {
      await save(next);
      setDialogGroupId(null);
      setMessage("Account saved locally.");
    } catch {
      setMessage(
        "The account could not be saved. Your existing data was not changed.",
      );
    }
  }

  async function submitActivity(
    input: QuickActivityInput,
  ): Promise<string | null> {
    if (!workspace) return "Your workspace is not ready yet.";
    const today = localToday();
    const amount = parseMoney(input.amount, false);
    const assetAccount = workspace.assetAccounts.find(
      (candidate) => candidate.id === input.accountId,
    );
    const liabilityAccount = workspace.liabilityAccounts.find(
      (candidate) => candidate.id === input.accountId,
    );
    if (amount === null || amount <= 0)
      return "Enter an amount greater than zero.";
    const canUseLiability =
      input.kind === "expense" &&
      (input.transactionType === "purchase" ||
        input.transactionType === "refund") &&
      liabilityAccount?.status === "active" &&
      (liabilityAccount.type === "credit-card" ||
        liabilityAccount.type === "line-of-credit");
    if (assetAccount?.status !== "active" && !canUseLiability)
      return "Choose an active account.";
    const destination = input.destinationAccountId
      ? workspace.assetAccounts.find(
          (candidate) => candidate.id === input.destinationAccountId,
        )
      : undefined;
    if (
      input.kind === "move" &&
      input.destinationAccountId &&
      !input.transferToUntrackedAccount &&
      (destination?.status !== "active" || destination.id === assetAccount?.id)
    )
      return "Choose a different active destination account.";
    const debtAccount = input.debtAccountId
      ? workspace.liabilityAccounts.find(
          (candidate) => candidate.id === input.debtAccountId,
        )
      : undefined;
    if (
      input.kind === "move" &&
      input.transactionType === "credit-card-payment" &&
      debtAccount?.status !== "active"
    )
      return "Choose the account you paid.";
    if (
      input.kind === "move" &&
      !input.destinationAccountId &&
      !input.transferToUntrackedAccount &&
      !input.debtAccountId
    )
      return "Choose where the money is going.";

    const billDefinition = input.definitionId
      ? workspace.expenseDefinitions.find(
          (definition) => definition.id === input.definitionId,
        )
      : undefined;
    if (
      input.definitionId &&
      (!billDefinition ||
        billDefinition.status === "paused" ||
        billDefinition.status === "cancelled")
    )
      return "Choose an active saved bill.";
    const billObligation = billDefinition
      ? classifyObligations(workspace, today, 90).find(
          (obligation) =>
            obligation.sourceId === billDefinition.id &&
            (obligation.status === "overdue" ||
              obligation.status === "upcoming") &&
            obligation.date !== null &&
            (obligation.remainingCents ?? 0) > 0,
        )
      : undefined;
    if (billDefinition && !billObligation)
      return "This bill has no unpaid occurrence in the next 90 days.";
    if (
      billObligation?.remainingCents !== null &&
      billObligation?.remainingCents !== undefined &&
      amount > billObligation.remainingCents
    )
      return `Enter no more than the ${formatCad(billObligation.remainingCents)} still due.`;

    const principalAmount = input.principalAmount
      ? parseMoney(input.principalAmount, false)
      : null;
    if (
      input.principalAmount &&
      (principalAmount === null ||
        principalAmount <= 0 ||
        principalAmount > amount)
    )
      return "Principal must be greater than $0 and no more than the payment.";

    const now = new Date().toISOString();
    const cents = asV2Cents(amount);
    try {
      const sourceDirection =
        input.kind === "income" || input.transactionType === "refund"
          ? "inflow"
          : "outflow";
      const updatedAssetAccount = assetAccount
        ? applyAssetAccountActivity(
            assetAccount,
            sourceDirection,
            cents,
            today,
            now,
          )
        : undefined;
      const updatedLiabilityAccount = liabilityAccount
        ? applyCreditActivity(
            liabilityAccount,
            input.transactionType === "refund" ? "decrease" : "increase",
            cents,
            today,
            now,
          )
        : undefined;
      const debtReduction = debtAccount
        ? debtAccount.type === "credit-card" ||
          debtAccount.type === "line-of-credit"
          ? cents
          : principalAmount === null
            ? null
            : asV2Cents(principalAmount)
        : null;
      const updatedDebtAccount =
        debtAccount && debtReduction !== null
          ? applyLiabilityAccountActivity(
              debtAccount,
              "decrease",
              debtReduction,
              today,
              now,
            )
          : undefined;
      const activityAccount = assetAccount ?? liabilityAccount;
      const relatedAccount = destination ?? debtAccount;
      const updatedDestination = destination
        ? applyAssetAccountActivity(destination, "inflow", cents, today, now)
        : undefined;
      const spendingCategory =
        input.transactionType === "credit-card-payment"
          ? "debt-payments"
          : input.transactionType === "savings-contribution"
            ? "savings-goals"
            : input.transactionType === "transfer"
              ? "other"
              : input.spendingCategory;
      const next = {
        ...workspace,
        updatedAt: now,
        asOfDate: today,
        assetAccounts: workspace.assetAccounts.map((candidate) => {
          if (candidate.id === updatedAssetAccount?.id)
            return updatedAssetAccount;
          if (candidate.id === updatedDestination?.id)
            return updatedDestination;
          return candidate;
        }),
        liabilityAccounts: workspace.liabilityAccounts.map((candidate) => {
          if (candidate.id === updatedLiabilityAccount?.id)
            return updatedLiabilityAccount;
          if (candidate.id === updatedDebtAccount?.id)
            return updatedDebtAccount;
          return candidate;
        }),
        ...(input.kind === "income"
          ? {
              historicalIncome: [
                ...workspace.historicalIncome,
                {
                  id: crypto.randomUUID() as HistoricalIncomeRecordId,
                  workspaceId: workspace.id,
                  name: input.incomeLabel,
                  ...(assetAccount ? { accountId: assetAccount.id } : {}),
                  amountCents: cents,
                  receivedDate: today,
                  provenance: "user-entered" as const,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            }
          : {
              expenseEvents: [
                ...workspace.expenseEvents,
                {
                  id: crypto.randomUUID() as ExpenseEventId,
                  workspaceId: workspace.id,
                  ...(activityAccount ? { accountId: activityAccount.id } : {}),
                  ...(relatedAccount
                    ? { relatedAccountId: relatedAccount.id }
                    : {}),
                  ...(debtAccount &&
                  debtAccount.type !== "credit-card" &&
                  debtAccount.type !== "line-of-credit"
                    ? {
                        principalAmountCents: debtReduction ?? asV2Cents(0),
                      }
                    : {}),
                  transactionType: input.transactionType,
                  ...(input.personPaymentPurpose
                    ? { personPaymentPurpose: input.personPaymentPurpose }
                    : {}),
                  ...(billDefinition
                    ? { definitionId: billDefinition.id }
                    : {}),
                  ...(input.note ? { note: input.note } : {}),
                  name: billDefinition
                    ? billDefinition.name
                    : input.transactionType === "transfer"
                      ? input.transferToUntrackedAccount
                        ? "Transfer to untracked account"
                        : "Transfer between accounts"
                      : input.transactionType === "credit-card-payment"
                        ? "Card or loan payment"
                        : input.transactionType === "savings-contribution"
                          ? "Savings or investment contribution"
                          : input.transactionType === "person-payment"
                            ? input.personPaymentPurpose === "gift"
                              ? "Gift sent"
                              : input.personPaymentPurpose === "pay-someone"
                                ? "Payment sent"
                                : "Money sent"
                            : `${input.transactionType === "refund" ? "Refund · " : ""}${BUDGET_CATEGORIES[spendingCategory]}`,
                  amountCents: cents,
                  category: billDefinition?.category ?? spendingCategory,
                  nature: billDefinition?.nature ?? ("variable" as const),
                  obligation:
                    billDefinition?.obligation ?? ("flexible" as const),
                  dueDate: billObligation?.date ?? today,
                  status: "actual" as const,
                  actualDate: today,
                  provenance: "user-entered" as const,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            }),
      };
      await save(next);
      setActivityKind(null);
      const accountName = activityAccount?.name ?? "account";
      setMessage(
        input.kind === "income"
          ? `${formatCad(cents)} added to ${accountName}.`
          : input.transactionType === "refund"
            ? `${formatCad(cents)} refund recorded for ${accountName}.`
            : input.transactionType === "transfer"
              ? input.transferToUntrackedAccount
                ? `${formatCad(cents)} moved from ${accountName} to another account you own.`
                : `${formatCad(cents)} moved from ${accountName} to ${destination?.name ?? "the destination account"}.`
              : input.transactionType === "credit-card-payment"
                ? debtAccount && debtReduction === null
                  ? `${formatCad(cents)} payment recorded. Add the principal split when known to update ${debtAccount.name}.`
                  : `${formatCad(cents)} payment recorded from ${accountName} to ${debtAccount?.name ?? "the debt account"}.`
                : input.transactionType === "purchase"
                  ? `${formatCad(cents)} spending recorded from ${accountName}.`
                  : `${formatCad(cents)} contribution recorded from ${accountName}.`,
      );
      return null;
    } catch {
      return "This activity could not be saved. Your balance was not changed.";
    }
  }

  async function submitBalanceUpdate(
    input: BalanceUpdateInput,
  ): Promise<string | null> {
    if (!workspace) return "Your workspace is not ready yet.";
    const account = workspace.assetAccounts.find(
      (candidate) => candidate.id === input.accountId,
    );
    const amount = parseMoney(input.amount, input.reason === "set");
    if (!account) return "Choose an account to update.";
    if (amount === null || (input.reason !== "set" && amount <= 0))
      return input.reason === "set"
        ? "Enter the new current balance."
        : "Enter an amount greater than $0.";
    const now = new Date().toISOString();
    const today = localToday();
    try {
      const updatedAccount =
        input.reason === "set"
          ? {
              ...account,
              currentValueCents: asV2Cents(amount),
              valueAsOfDate: today,
              updatedAt: now,
            }
          : applyAssetAccountActivity(
              account,
              input.reason === "loss" || input.reason === "fee-withdrawal"
                ? "outflow"
                : "inflow",
              asV2Cents(amount),
              today,
              now,
            );
      await save({
        ...workspace,
        updatedAt: now,
        asOfDate: today,
        assetAccounts: workspace.assetAccounts.map((candidate) =>
          candidate.id === account.id ? updatedAccount : candidate,
        ),
      });
      const reasonLabel = BALANCE_UPDATE_REASONS.find(
        (option) => option.value === input.reason,
      )?.label;
      setBalanceUpdateAssetId(null);
      setMessage(
        `${account.name} updated to ${formatCad(updatedAccount.currentValueCents)}${reasonLabel ? ` · ${reasonLabel}` : ""}.`,
      );
      return null;
    } catch {
      return "The balance could not be updated. Nothing was changed.";
    }
  }

  async function remove(id: string, accountKind: "asset" | "liability") {
    if (!workspace) return;
    const now = new Date().toISOString();
    const next =
      accountKind === "asset"
        ? {
            ...workspace,
            updatedAt: now,
            assetAccounts: workspace.assetAccounts.filter(
              (account) => account.id !== id,
            ),
          }
        : {
            ...workspace,
            updatedAt: now,
            liabilityAccounts: workspace.liabilityAccounts.filter(
              (account) => account.id !== id,
            ),
          };
    await save(next);
  }

  async function removeProvider(group: AccountGroup) {
    if (!workspace) return;
    const accountCount =
      workspace.assetAccounts.filter((account) => account.groupId === group.id)
        .length +
      workspace.liabilityAccounts.filter(
        (account) => account.groupId === group.id,
      ).length;
    if (
      accountCount > 0 &&
      !window.confirm(
        `Remove ${group.name} and ${String(accountCount)} ${accountCount === 1 ? "account" : "accounts"} inside it?`,
      )
    )
      return;
    const now = new Date().toISOString();
    try {
      await save({
        ...workspace,
        updatedAt: now,
        accountGroups: workspace.accountGroups.filter(
          (candidate) => candidate.id !== group.id,
        ),
        assetAccounts: workspace.assetAccounts.filter(
          (account) => account.groupId !== group.id,
        ),
        liabilityAccounts: workspace.liabilityAccounts.filter(
          (account) => account.groupId !== group.id,
        ),
      });
      setMessage(`${group.name} removed.`);
    } catch {
      setMessage(`${group.name} could not be removed. Nothing was changed.`);
    }
  }

  const ungroupedAssets = assets.filter(
    (account) => account.groupId === undefined,
  );
  const ungroupedLiabilities = liabilities.filter(
    (account) => account.groupId === undefined,
  );

  if (loading) return <LoadingState label="Loading your accounts…" />;
  return (
    <div className="accounts-layout">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {workspace && (
        <>
          <section className="account-totals" aria-label="Account totals">
            <div>
              <span>Spendable</span>
              <strong>{formatCad(deriveSpendableCashCents(assets))}</strong>
            </div>
            <div>
              <span>Owed</span>
              <strong>
                {formatCad(deriveTotalLiabilitiesCents(liabilities))}
              </strong>
            </div>
          </section>
          <details className="account-more-totals">
            <summary>More totals</summary>
            <section
              className="account-totals"
              aria-label="More account totals"
            >
              <div>
                <span>Net worth</span>
                <strong>
                  {formatCad(deriveNetWorthCents(assets, liabilities))}
                </strong>
              </div>
              <div>
                <span>Assets</span>
                <strong>
                  {formatCad(deriveTotalOwnedCents(assets, liabilities))}
                </strong>
              </div>
            </section>
          </details>
        </>
      )}

      <section className="account-quick-actions" aria-label="Quick actions">
        <button
          className="quick-money-action quick-money-in"
          type="button"
          onClick={() => {
            openActivity("income");
          }}
        >
          <span aria-hidden="true">+</span>
          <strong>Add income</strong>
          <small>Salary, benefit, gift</small>
        </button>
        <button
          className="quick-money-action"
          type="button"
          onClick={() => {
            openActivity("expense");
          }}
        >
          <span aria-hidden="true">−</span>
          <strong>Record expense</strong>
          <small>Purchase, bill, refund</small>
        </button>
        <button
          className="quick-money-action quick-money-move"
          type="button"
          onClick={() => {
            openActivity("move");
          }}
        >
          <span aria-hidden="true">→</span>
          <strong>Move money</strong>
          <small>Transfer, save, or pay debt</small>
        </button>
      </section>

      <div className="accounts-toolbar">
        <div>
          <h2>Your banks and providers</h2>
          <p>
            Add BMO, TD, MEXC, Wealthsimple, a school, or cash—then add the
            accounts inside each one.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            openDialog();
          }}
        >
          + Add provider
        </button>
      </div>

      {groups.length === 0 &&
      ungroupedAssets.length + ungroupedLiabilities.length === 0 ? (
        <button
          className="empty-account-state"
          type="button"
          onClick={() => {
            openDialog();
          }}
        >
          <span className="empty-state-plus" aria-hidden="true">
            +
          </span>
          <strong>Add your first bank or provider</strong>
          <small>
            Then add chequing, savings, credit cards, crypto, TFSA, RRSP, or
            other accounts inside it.
          </small>
        </button>
      ) : null}

      <div className="account-group-list">
        {groups.map((group) => {
          const groupAssets = assets.filter(
            (account) => account.groupId === group.id,
          );
          const groupLiabilities = liabilities.filter(
            (account) => account.groupId === group.id,
          );
          return (
            <section className="account-group-card" key={group.id}>
              <header>
                <div>
                  <h3>{group.name}</h3>
                  <p title={groupLabels[group.type]}>
                    {groupLabels[group.type]}
                  </p>
                </div>
                <div className="account-group-actions">
                  <button
                    className="add-account-button"
                    type="button"
                    onClick={() => {
                      openDialog(group.id);
                    }}
                  >
                    + Account
                  </button>
                  <ActionMenu
                    provider
                    label={`More provider actions for ${group.name}`}
                    title={group.name}
                    actionLabel="Remove provider"
                    onAction={() => void removeProvider(group)}
                  />
                </div>
              </header>
              <AccountRows
                assets={groupAssets}
                liabilities={groupLiabilities}
                onRemove={remove}
                onUpdateAsset={(account) => {
                  setBalanceUpdateAssetId(account.id);
                }}
                onEditLiability={editLiability}
              />
            </section>
          );
        })}
        {ungroupedAssets.length + ungroupedLiabilities.length > 0 && (
          <section className="account-group-card">
            <header>
              <div>
                <h3>Other accounts</h3>
                <p>Added before account grouping</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  openDialog();
                }}
              >
                + Account
              </button>
            </header>
            <AccountRows
              assets={ungroupedAssets}
              liabilities={ungroupedLiabilities}
              onRemove={remove}
              onUpdateAsset={(account) => {
                setBalanceUpdateAssetId(account.id);
              }}
              onEditLiability={editLiability}
            />
          </section>
        )}
      </div>

      {message && !dialogOpen && activityKind === null && (
        <p className="save-message" role="status">
          {message}
        </p>
      )}

      {workspace && <TransactionHistory workspace={workspace} save={save} />}

      <CommitmentsManager workspace={activeWorkspace} save={save} />

      {activityKind && (
        <QuickActivityDialog
          kind={activityKind}
          accounts={activeAssets}
          liabilityAccounts={liabilities}
          accountGroups={groups}
          expenseDefinitions={workspace?.expenseDefinitions ?? []}
          onClose={() => {
            setActivityKind(null);
          }}
          onSave={submitActivity}
        />
      )}

      {balanceUpdateAccount && (
        <AccountBalanceDialog
          account={balanceUpdateAccount}
          onClose={() => {
            setBalanceUpdateAssetId(null);
          }}
          onSave={submitBalanceUpdate}
        />
      )}

      {dialogOpen && (
        <div
          className={`modal-backdrop${editingLiabilityId ? " debt-dialog-backdrop money-dialog-backdrop" : ""}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogGroupId(null);
          }}
        >
          <section
            className={`account-dialog${editingLiabilityId ? " debt-account-dialog money-dialog" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-account-heading"
          >
            <header>
              <div>
                <p className="wizard-progress">Step {step} of 3</p>
                <h2 id="add-account-heading">
                  {editingLiabilityId
                    ? "Update debt details"
                    : step === 1
                      ? "Where do you keep it?"
                      : step === 2
                        ? "Choose the account type"
                        : "What is the balance?"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setDialogGroupId(null);
                }}
              >
                ×
              </button>
            </header>
            <form
              className="account-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (step < 3) continueFlow();
                else void submit();
              }}
            >
              <div className="wizard-track" aria-hidden="true">
                {[1, 2, 3].map((item) => (
                  <span key={item} data-active={item <= step} />
                ))}
              </div>
              {step === 1 && (
                <div className="wizard-step">
                  {groups.length > 0 && (
                    <label>
                      Choose an existing bank or provider
                      <select
                        value={dialogGroupId}
                        onChange={(event) => {
                          setDialogGroupId(event.target.value);
                        }}
                      >
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                        <option value="new">Add a new bank or provider</option>
                      </select>
                    </label>
                  )}
                  {dialogGroupId === "new" && (
                    <>
                      <label>
                        What are you adding?
                        <select
                          value={newGroupType}
                          onChange={(event) => {
                            const nextType = event.target
                              .value as AccountGroupType;
                            setNewGroupType(nextType);
                            if (nextType === "cash") setNewGroupName("");
                            prepareAccountForProvider(nextType);
                          }}
                        >
                          {PROVIDER_TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>
                              {groupLabels[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {newGroupType === "cash" ? (
                        <p className="cash-place-note">
                          No name needed. Cash will appear as its own place.
                        </p>
                      ) : (
                        <label>
                          {providerNameLabel(newGroupType)}
                          <input
                            value={newGroupName}
                            onChange={(event) => {
                              setNewGroupName(event.target.value);
                            }}
                            autoComplete="organization"
                            placeholder={providerPlaceholder(newGroupType)}
                            autoFocus
                          />
                          {providerHelp(newGroupType) && (
                            <small>{providerHelp(newGroupType)}</small>
                          )}
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="wizard-step">
                  <div className="segmented-control" aria-label="Account kind">
                    <button
                      type="button"
                      aria-pressed={kind === "asset"}
                      onClick={() => {
                        setKind("asset");
                      }}
                    >
                      Money I have
                    </button>
                    <button
                      type="button"
                      aria-pressed={kind === "liability"}
                      onClick={() => {
                        setKind("liability");
                      }}
                    >
                      Money I owe
                    </button>
                  </div>
                  <label>
                    Account type
                    <select
                      aria-label="Account type"
                      value={kind === "asset" ? assetType : liabilityType}
                      onChange={(event) => {
                        if (kind === "asset")
                          setAssetType(event.target.value as AssetAccountType);
                        else
                          setLiabilityType(
                            event.target.value as LiabilityAccountType,
                          );
                      }}
                    >
                      {(kind === "asset"
                        ? ASSET_ACCOUNT_TYPES
                        : LIABILITY_ACCOUNT_TYPES
                      ).map((type) => (
                        <option key={type} value={type}>
                          {accountLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isEducationPlace && kind === "liability" && (
                    <p className="cash-place-note">
                      Choose Student loan for borrowed education funds. Choose
                      Tuition owed to a school for an unpaid balance billed
                      directly by your university or college.
                    </p>
                  )}
                  <details className="optional-account-name">
                    <summary>Add a nickname (optional)</summary>
                    <label>
                      Account nickname
                      <input
                        name="moni2go-account-nickname"
                        value={accountName}
                        onChange={(event) => {
                          setAccountName(event.target.value);
                        }}
                        autoComplete="new-password"
                        placeholder="For example, Daily spending"
                      />
                    </label>
                  </details>
                </div>
              )}
              {step === 3 && (
                <div className="wizard-step">
                  <p className="wizard-summary">
                    <strong>
                      {accountName.trim() ||
                        accountLabels[
                          kind === "asset" ? assetType : liabilityType
                        ]}
                    </strong>
                    <span>
                      {accountName.trim()
                        ? accountLabels[
                            kind === "asset" ? assetType : liabilityType
                          ]
                        : "Default name based on account type"}
                    </span>
                  </p>
                  <label>
                    Current {kind === "asset" ? "value" : "amount owed"}
                    <span className="money-input">
                      <span>$</span>
                      <input
                        value={valueInput}
                        onChange={(event) => {
                          setValueInput(event.target.value);
                        }}
                        inputMode="decimal"
                        aria-describedby="value-help"
                        autoFocus
                      />
                    </span>
                    <small id="value-help">
                      {kind === "liability" && liabilityType === "credit-card"
                        ? "Enter $0 if the card is paid off. Your credit limit is not money you own."
                        : "CAD · manually entered"}
                    </small>
                  </label>
                  {kind === "liability" && (
                    <>
                      <label>
                        {liabilityType === "credit-card" ||
                        liabilityType === "line-of-credit"
                          ? "Payment status"
                          : "Payment schedule"}
                        <select
                          value={paymentRequirement}
                          onChange={(event) => {
                            setPaymentRequirement(
                              event.target.value as DebtPaymentRequirement,
                            );
                            setMonthlyPaymentInput("");
                            setNextPaymentDateInput("");
                            setTargetPayoffDateInput("");
                          }}
                        >
                          <option value="required">Required payment</option>
                          <option value="flexible">
                            {liabilityType === "credit-card" ||
                            liabilityType === "line-of-credit"
                              ? "No payment due recorded"
                              : "No fixed payment"}
                          </option>
                        </select>
                      </label>
                      {paymentRequirement === "required" &&
                      !hasZeroLiabilityBalance ? (
                        <div className="debt-payment-fields">
                          <label>
                            Required payment amount
                            <span className="money-input">
                              <span>$</span>
                              <input
                                value={monthlyPaymentInput}
                                onChange={(event) => {
                                  setMonthlyPaymentInput(event.target.value);
                                }}
                                inputMode="decimal"
                                aria-describedby="required-payment-help"
                              />
                            </span>
                            <small id="required-payment-help">
                              Enter the amount required for each payment—not the
                              full balance.
                            </small>
                          </label>
                          <label>
                            How often?
                            <select
                              value={paymentFrequency}
                              onChange={(event) => {
                                setPaymentFrequency(
                                  event.target.value as DebtPaymentFrequency,
                                );
                              }}
                            >
                              {DEBT_PAYMENT_FREQUENCIES.map((frequency) => (
                                <option key={frequency} value={frequency}>
                                  {paymentFrequencyLabels[frequency]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Next payment date (optional)
                            <input
                              type="date"
                              min={localToday()}
                              value={nextPaymentDateInput}
                              onChange={(event) => {
                                setNextPaymentDateInput(event.target.value);
                              }}
                            />
                            <small>
                              Choose the full date so the month and year are
                              clear.
                            </small>
                          </label>
                        </div>
                      ) : paymentRequirement === "flexible" &&
                        (liabilityType === "credit-card" ||
                          liabilityType === "line-of-credit") ? (
                        <p className="cash-place-note compact-debt-note">
                          No statement payment is recorded yet. Add the real
                          required amount and due date when your lender provides
                          them.
                        </p>
                      ) : paymentRequirement === "flexible" ? (
                        <div className="debt-payment-fields">
                          <p className="cash-place-note">
                            You choose when and how much to pay. moni2go will
                            not add a required payment to your plan.
                          </p>
                          <label>
                            Target payoff date (optional)
                            <input
                              type="date"
                              min={localToday()}
                              value={targetPayoffDateInput}
                              onChange={(event) => {
                                setTargetPayoffDateInput(event.target.value);
                              }}
                            />
                            <small>
                              This is your planning target, not a required
                              lender payment or automatic reminder.
                            </small>
                          </label>
                        </div>
                      ) : (
                        <p className="cash-place-note">
                          Nothing is due while the current balance is $0. If you
                          add an amount owed later, moni2go will ask for the
                          required payment details.
                        </p>
                      )}
                    </>
                  )}
                  {kind === "asset" && (
                    <label>
                      Available to spend?
                      <select
                        value={spendability}
                        onChange={(event) => {
                          setSpendability(event.target.value as Spendability);
                        }}
                      >
                        <option value="spendable">Yes, available now</option>
                        <option value="restricted">
                          No, reserved or restricted
                        </option>
                        <option value="non-cash">
                          No, investment or non-cash asset
                        </option>
                      </select>
                    </label>
                  )}
                </div>
              )}
              {message && (
                <p className="form-error" role="alert">
                  {message}
                </p>
              )}
              <div className="wizard-actions">
                {step > 1 && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      setMessage(null);
                      setStep(
                        step === 3 &&
                          dialogGroupId === "new" &&
                          newGroupType === "cash"
                          ? 1
                          : ((step - 1) as 1 | 2),
                      );
                    }}
                  >
                    Back
                  </button>
                )}
                <button className="button button-primary" type="submit">
                  {step === 3 ? "Save account" : "Continue"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
