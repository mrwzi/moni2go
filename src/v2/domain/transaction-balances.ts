import type { AssetAccount, LiabilityAccount } from "./accounts";
import type { DatedExpenseEvent } from "./expenses";
import type { HistoricalIncomeRecord } from "./income";
import { asV2Cents } from "./money";
import type { CalendarDate, FinancialEntityId } from "./types";
import type { FinancialWorkspace } from "./workspace";

type BalanceEffect = Readonly<{
  accountId: FinancialEntityId;
  accountKind: "asset" | "liability";
  deltaCents: number;
}>;

function expenseEffects(
  workspace: FinancialWorkspace,
  event: DatedExpenseEvent,
): BalanceEffect[] {
  if (!event.accountId) return [];
  const amount = Number(event.amountCents);
  const type = event.transactionType ?? "purchase";
  const sourceIsLiability = workspace.liabilityAccounts.some(
    (account) => account.id === event.accountId,
  );
  if (type === "purchase" || type === "person-payment") {
    return [
      {
        accountId: event.accountId,
        accountKind: sourceIsLiability ? "liability" : "asset",
        deltaCents: sourceIsLiability ? amount : -amount,
      },
    ];
  }
  if (type === "refund") {
    return [
      {
        accountId: event.accountId,
        accountKind: sourceIsLiability ? "liability" : "asset",
        deltaCents: sourceIsLiability ? -amount : amount,
      },
    ];
  }
  if (type === "transfer" || type === "savings-contribution") {
    return [
      { accountId: event.accountId, accountKind: "asset", deltaCents: -amount },
      ...(event.relatedAccountId
        ? [
            {
              accountId: event.relatedAccountId,
              accountKind: "asset" as const,
              deltaCents: amount,
            },
          ]
        : []),
    ];
  }
  const principal = Number(event.principalAmountCents ?? event.amountCents);
  return [
    { accountId: event.accountId, accountKind: "asset", deltaCents: -amount },
    ...(event.relatedAccountId && principal > 0
      ? [
          {
            accountId: event.relatedAccountId,
            accountKind: "liability" as const,
            deltaCents: -principal,
          },
        ]
      : []),
  ];
}

function applyEffects(
  workspace: FinancialWorkspace,
  effects: readonly BalanceEffect[],
  direction: 1 | -1,
  date: CalendarDate,
  updatedAt: string,
): FinancialWorkspace {
  const assetDeltas = new Map<string, number>();
  const liabilityDeltas = new Map<string, number>();
  for (const effect of effects) {
    const target =
      effect.accountKind === "asset" ? assetDeltas : liabilityDeltas;
    target.set(
      effect.accountId,
      (target.get(effect.accountId) ?? 0) + effect.deltaCents * direction,
    );
  }
  return {
    ...workspace,
    updatedAt,
    asOfDate: date,
    assetAccounts: workspace.assetAccounts.map((account): AssetAccount => {
      const delta = assetDeltas.get(account.id);
      return delta === undefined
        ? account
        : {
            ...account,
            currentValueCents: asV2Cents(
              Number(account.currentValueCents) + delta,
            ),
            valueAsOfDate: date,
            updatedAt,
          };
    }),
    liabilityAccounts: workspace.liabilityAccounts.map(
      (account): LiabilityAccount => {
        const delta = liabilityDeltas.get(account.id);
        return delta === undefined
          ? account
          : {
              ...account,
              currentBalanceCents: asV2Cents(
                Number(account.currentBalanceCents) + delta,
              ),
              balanceAsOfDate: date,
              updatedAt,
            };
      },
    ),
  };
}

export function applyExpenseBalanceEffect(
  workspace: FinancialWorkspace,
  event: DatedExpenseEvent,
  direction: "apply" | "reverse",
  date: CalendarDate,
  updatedAt: string,
): FinancialWorkspace {
  const effects = expenseEffects(workspace, event);
  return applyEffects(
    workspace,
    effects,
    direction === "apply" ? 1 : -1,
    date,
    updatedAt,
  );
}

export function applyIncomeBalanceEffect(
  workspace: FinancialWorkspace,
  income: HistoricalIncomeRecord,
  direction: "apply" | "reverse",
  date: CalendarDate,
  updatedAt: string,
): FinancialWorkspace {
  if (!income.accountId) return { ...workspace, updatedAt };
  return applyEffects(
    workspace,
    [
      {
        accountId: income.accountId,
        accountKind: "asset",
        deltaCents: Number(income.amountCents),
      },
    ],
    direction === "apply" ? 1 : -1,
    date,
    updatedAt,
  );
}

export function affectedTransactionAccountIds(
  transaction: DatedExpenseEvent | HistoricalIncomeRecord,
): readonly FinancialEntityId[] {
  if ("receivedDate" in transaction)
    return transaction.accountId ? [transaction.accountId] : [];
  return [transaction.accountId, transaction.relatedAccountId].filter(
    (id): id is FinancialEntityId => Boolean(id),
  );
}
