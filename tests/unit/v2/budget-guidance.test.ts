import { describe, expect, it } from "vitest";
import {
  BUDGET_GUIDANCE_THRESHOLDS,
  createCategoryBudgetGuidance,
  prioritizePlanAdjustments,
} from "../../../src/v2/domain/budget-guidance";
import {
  PLAN_ADJUSTMENT_ORDER,
  PLAN_CATEGORY_KEYS,
  PLAN_CATEGORY_PRIORITIES,
} from "../../../src/v2/domain/budget-categories";
import { asV2Cents } from "../../../src/v2/domain/money";

const guidance = (
  category: (typeof PLAN_CATEGORY_KEYS)[number],
  plan: number,
  spent: number,
  historical: number | null = null,
) =>
  createCategoryBudgetGuidance({
    category,
    planCents: asV2Cents(plan),
    spentThisMonthCents: asV2Cents(spent),
    historicalAverageCents: historical === null ? null : asV2Cents(historical),
  });

describe("priority-aware budget guidance", () => {
  it("classifies every Plan category once from a central map", () => {
    expect(Object.keys(PLAN_CATEGORY_PRIORITIES)).toEqual(PLAN_CATEGORY_KEYS);
    expect(new Set(PLAN_ADJUSTMENT_ORDER)).toEqual(new Set(PLAN_CATEGORY_KEYS));
    expect(PLAN_CATEGORY_PRIORITIES.housing).toBe("essential");
    expect(PLAN_CATEGORY_PRIORITIES.groceries).toBe("semi-flexible");
    expect(PLAN_CATEGORY_PRIORITIES["debt-payments"]).toBe("required-debt");
    expect(PLAN_CATEGORY_PRIORITIES["savings-goals"]).toBe("financial-goal");
    expect(PLAN_CATEGORY_PRIORITIES.restaurants).toBe("discretionary");
  });

  it("documents stable centralized tolerances", () => {
    expect(BUDGET_GUIDANCE_THRESHOLDS).toEqual({
      nearPlanBasisPoints: 9_000,
      meaningfulOverageBasisPoints: 500,
      minimumMeaningfulOverageCents: 500,
      historicalAlignmentBasisPoints: 1_000,
      minimumHistoricalAlignmentCents: 1_000,
    });
  });

  it("stays quiet below budget and gives a subtle near-budget indicator", () => {
    expect(guidance("restaurants", 10_000, 5_000).level).toBe("under");
    expect(guidance("restaurants", 10_000, 5_000).message).toBeNull();
    expect(guidance("restaurants", 10_000, 9_500).level).toBe("near");
    expect(guidance("restaurants", 10_000, 10_000).message).toContain(
      "close to",
    );
  });

  it("treats a small overage as near and a meaningful overage as over", () => {
    expect(guidance("shopping", 10_000, 10_400).level).toBe("near");
    const result = guidance("shopping", 10_000, 12_800);
    expect(result.level).toBe("over");
    expect(result.overByCents).toBe(2_800);
    expect(result.message).toContain("reducing upcoming discretionary");
    expect(result.message).toContain("updating the plan");
  });

  it("uses history to identify a discretionary plan that may be unrealistic", () => {
    const result = guidance("restaurants", 10_000, 14_500, 13_800);
    expect(result.historicalContext).toBe("plan-may-be-low");
    expect(result.message).toContain("usual monthly spending");
    expect(result.message).toContain("plan may be lower than realistic");
  });

  it("does not tell users to cut normal essential housing", () => {
    const result = guidance("housing", 140_000, 155_000, 155_000);
    expect(result.priority).toBe("essential");
    expect(result.message).toContain("update the plan");
    expect(result.message).toContain("review flexible categories elsewhere");
    expect(result.message).not.toContain("reduce your housing");
  });

  it("uses softer language for grocery overspending", () => {
    const result = guidance("groceries", 40_000, 43_500, 42_000);
    expect(result.message).toContain("food costs have increased");
    expect(result.message).toContain("before cutting essential food spending");
  });

  it("protects required debt payments", () => {
    const result = guidance("debt-payments", 20_000, 25_000);
    expect(result.message).toContain("Do not skip a required payment");
    expect(result.message).toContain("reducing flexible categories");
  });

  it("keeps savings goals user-controlled", () => {
    const result = guidance("savings-goals", 20_000, 30_000);
    expect(result.message).toContain("Keep the goal if it remains affordable");
    expect(result.message).toContain("essential costs");
  });

  it("reviews discretionary amounts before savings and never suggests required costs", () => {
    expect(
      prioritizePlanAdjustments([
        { category: "housing", amountCents: asV2Cents(150_000) },
        { category: "debt-payments", amountCents: asV2Cents(20_000) },
        { category: "savings-goals", amountCents: asV2Cents(30_000) },
        { category: "restaurants", amountCents: asV2Cents(10_000) },
        { category: "subscriptions", amountCents: asV2Cents(2_000) },
      ]),
    ).toEqual(["subscriptions", "restaurants", "savings-goals"]);
  });
});
