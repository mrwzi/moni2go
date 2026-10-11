import { describe, expect, it } from "vitest";
import {
  applyLiabilityAccountActivity,
  type LiabilityAccount,
} from "../../../src/v2/domain/accounts";
import { parseCalendarDate } from "../../../src/v2/domain/calendar";
import { asV2Cents } from "../../../src/v2/domain/money";

const card = {
  id: "card-1",
  workspaceId: "workspace-1",
  name: "Credit card",
  type: "credit-card",
  currentBalanceCents: asV2Cents(42_000),
  balanceAsOfDate: parseCalendarDate("2026-04-01"),
  includeInNetWorth: true,
  status: "active",
  provenance: "user-entered",
  paymentRequirement: "required",
  requiredMonthlyPaymentCents: asV2Cents(3_500),
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
} as LiabilityAccount;

describe("liability account activity", () => {
  it("increases debt for a purchase and decreases it for a payment", () => {
    const purchase = applyLiabilityAccountActivity(
      card,
      "increase",
      asV2Cents(5_000),
      parseCalendarDate("2026-04-10"),
      "2026-04-10T00:00:00.000Z",
    );
    expect(purchase.currentBalanceCents).toBe(47_000);
    const payment = applyLiabilityAccountActivity(
      purchase,
      "decrease",
      asV2Cents(10_000),
      parseCalendarDate("2026-04-15"),
      "2026-04-15T00:00:00.000Z",
    );
    expect(payment.currentBalanceCents).toBe(37_000);
  });

  it("does not allow a payment or refund to create a negative debt", () => {
    expect(() =>
      applyLiabilityAccountActivity(
        card,
        "decrease",
        asV2Cents(42_001),
        parseCalendarDate("2026-04-15"),
        "2026-04-15T00:00:00.000Z",
      ),
    ).toThrow("negative balance");
  });
});
