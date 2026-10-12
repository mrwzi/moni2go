import type { DemoProfile } from "../domain/types";

const provenance =
  "Synthetic example created for moni2go; not a statistical average." as const;

export const DEMO_PROFILE_CONTEXT: Readonly<
  Record<DemoProfile["id"], Readonly<{ purpose: string; construction: string }>>
> = {
  "student-family": {
    purpose:
      "Demonstrates a baseline with a smaller housing contribution and multiple monthly allocations.",
    construction:
      "The categories were constructed to show how household costs, debt payments, and planned savings remain distinct.",
  },
  "student-renter": {
    purpose: "Demonstrates sensitivity to a change in monthly housing cost.",
    construction:
      "The categories were constructed to reproduce moni2go's audited renter reference case.",
  },
  "student-part-time": {
    purpose:
      "Demonstrates a baseline containing housing, debt payments, other monthly expenses, and planned savings.",
    construction:
      "The categories were constructed to exercise every baseline field with part-time income.",
  },
  "recent-graduate": {
    purpose:
      "Demonstrates scenario calculations at a higher monthly take-home income and outflow scale.",
    construction:
      "The categories were constructed to test the same model with larger illustrative values.",
  },
};

export const DEMO_PROFILES = [
  {
    source: "synthetic-demo",
    id: "student-family",
    name: "Student living with family",
    description: "A student contributing to household costs while studying.",
    baseline: {
      incomeCents: 140_000,
      housingCents: 30_000,
      otherExpensesCents: 65_000,
      debtPaymentsCents: 10_000,
      plannedSavingsCents: 20_000,
    },
    provenance,
  },
  {
    source: "synthetic-demo",
    id: "student-renter",
    name: "Student renting near university",
    description:
      "A student renting independently with no required monthly debt payment.",
    baseline: {
      incomeCents: 165_000,
      housingCents: 85_000,
      otherExpensesCents: 58_000,
      debtPaymentsCents: 0,
      plannedSavingsCents: 15_000,
    },
    provenance,
  },
  {
    source: "synthetic-demo",
    id: "student-part-time",
    name: "Student working part-time",
    description:
      "A student balancing part-time income, rent, debt, and planned savings.",
    baseline: {
      incomeCents: 195_000,
      housingCents: 75_000,
      otherExpensesCents: 70_000,
      debtPaymentsCents: 15_000,
      plannedSavingsCents: 20_000,
    },
    provenance,
  },
  {
    source: "synthetic-demo",
    id: "recent-graduate",
    name: "Recent graduate working full-time",
    description:
      "A recent graduate with full-time income, rent, debt, and a savings plan.",
    baseline: {
      incomeCents: 360_000,
      housingCents: 145_000,
      otherExpensesCents: 100_000,
      debtPaymentsCents: 35_000,
      plannedSavingsCents: 50_000,
    },
    provenance,
  },
] as const satisfies readonly DemoProfile[];

export function getDemoProfile(id: DemoProfile["id"]): DemoProfile {
  const profile = DEMO_PROFILES.find((candidate) => candidate.id === id);
  if (profile === undefined) throw new Error(`Unknown demo profile: ${id}`);
  return profile;
}
