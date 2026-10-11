import { expect, test } from "@playwright/test";

test("allocates account money and models a purchase without changing the balance", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Test bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("1000");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("420");
  await page.getByLabel("Required monthly payment").fill("35");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.goto("/plan");
  await expect(
    page
      .getByRole("region", { name: "What are you planning?" })
      .getByText("$1,000.00"),
  ).toBeVisible();

  await expect(page.getByText("Step 1 of 13")).toBeVisible();
  await page
    .getByRole("button", { name: "I do not pay housing costs" })
    .click();
  await page
    .getByRole("button", { name: "Utilities are included or not applicable" })
    .click();
  await page.getByRole("button", { name: "No phone or internet cost" }).click();
  await page.getByRole("button", { name: "No insurance amount" }).click();
  await page.getByLabel("Groceries amount").fill("250");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "No eating-out amount" }).click();
  await page
    .getByRole("button", { name: "I do not have transportation costs" })
    .click();
  await page
    .getByRole("button", { name: "No health or personal-care amount" })
    .click();
  await page.getByLabel("Savings / goals amount").fill("100");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Clothing amount").fill("50");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "No shopping amount" }).click();
  await page
    .getByRole("button", { name: "No subscriptions or memberships" })
    .click();
  await page.getByRole("button", { name: "No entertainment amount" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: "Debt payments" }),
  ).toContainText("$35.00");
  await expect(page.getByText("$565.00")).toBeVisible();
  await expect(page.getByText("Review plan checks")).toBeVisible();

  await page.getByText("Test a purchase").click();
  await page.getByLabel("Purchase amount").fill("75");
  await expect(page.getByText("Money after purchase:")).toContainText(
    "$925.00",
  );
  await expect(page.getByText("Category amount after purchase:")).toContainText(
    "$175.00",
  );
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByText("Plan saved in this browser.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Groceries" }),
  ).toContainText("$250.00");
  await expect(
    page
      .getByRole("region", { name: "What are you planning?" })
      .getByText("$1,000.00"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Next payment" }).click();
  await page.getByLabel("Expected take-home payment").fill("1000");
  await page.getByRole("button", { name: "Create suggested split" }).click();
  await expect(
    page.getByText("Drafted from the proportions in your monthly plan."),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Groceries" }),
  ).toContainText("$603.13");
  await expect(page.getByText("$1,000.00")).toHaveCount(2);

  await page.goto("/");
  await expect(page.getByText("Where your money goes")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Plan my next payment" }),
  ).toBeVisible();
});

test("shows current spending separately from completed-month averages", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("History bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("2000");
  await page.getByRole("button", { name: "Save account" }).click();

  const completedDate = (monthsAgo: number) => {
    const date = new Date();
    date.setDate(10);
    date.setMonth(date.getMonth() - monthsAgo);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      "10",
    ].join("-");
  };

  for (const [amount, monthsAgo] of [
    ["120", 3],
    ["180", 2],
    ["150", 1],
  ] as const) {
    await page.getByRole("button", { name: "Money out" }).click();
    await page.getByLabel("What was it for?").selectOption("groceries");
    await page.getByLabel("Amount").fill(amount);
    await page.getByRole("button", { name: "Save spending" }).click();
    const transaction = page
      .getByRole("region", { name: "Recent transactions" })
      .getByRole("listitem")
      .filter({ hasText: `$${amount}.00` });
    await transaction.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    await dialog
      .getByLabel("Date", { exact: true })
      .fill(completedDate(monthsAgo));
    await dialog.getByRole("button", { name: "Save transaction" }).click();
  }

  await page.getByRole("button", { name: "Money out" }).click();
  await page.getByLabel("What was it for?").selectOption("groceries");
  await page.getByLabel("Amount").fill("75");
  await page.getByRole("button", { name: "Save spending" }).click();

  await page.goto("/plan");
  await page
    .getByRole("button", { name: "I do not pay housing costs" })
    .click();
  await page
    .getByRole("button", { name: "Utilities are included or not applicable" })
    .click();
  await page.getByRole("button", { name: "No phone or internet cost" }).click();
  await page.getByRole("button", { name: "No insurance amount" }).click();
  await page.getByLabel("Groceries amount").fill("100");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "No eating-out amount" }).click();
  await page
    .getByRole("button", { name: "I do not have transportation costs" })
    .click();
  await page
    .getByRole("button", { name: "No health or personal-care amount" })
    .click();
  await page.getByRole("button", { name: "Not right now" }).click();
  await page.getByRole("button", { name: "No clothing amount" }).click();
  await page.getByRole("button", { name: "No shopping amount" }).click();
  await page
    .getByRole("button", { name: "No subscriptions or memberships" })
    .click();
  await page.getByRole("button", { name: "No entertainment amount" }).click();

  const groceries = page.getByRole("listitem").filter({ hasText: "Groceries" });
  await expect(groceries).toContainText("$100.00");
  await expect(groceries).toContainText("Spent this month: $75.00");
  await expect(groceries).toContainText("Typical monthly spending: $150.00");
});
