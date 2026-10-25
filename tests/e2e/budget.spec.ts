import { expect, test, type Page } from "@playwright/test";

async function chooseMoneyOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function chooseFirstMoneyOption(page: Page, label: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option").first().click();
}

test("allocates account money and keeps the review focused", async ({
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
  await page.getByLabel("Required payment amount").fill("35");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.goto("/plan");
  await expect(page.getByText("Step 1 of 14")).toBeVisible();
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
  await page.getByLabel("Education amount").fill("75");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Savings & goals amount").fill("100");
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
  await expect(
    page.getByText("Monthly plan updated automatically."),
  ).toBeVisible();
  await expect(page.getByText("Review plan checks")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Your monthly plan" })
      .getByRole("listitem"),
  ).toHaveCount(5);
  await expect(
    page
      .getByRole("region", { name: "Your monthly plan" })
      .getByRole("listitem")
      .filter({ hasText: "Education" }),
  ).toContainText("$75.00");
  await page.getByText("Show unused categories").click();
  await expect(
    page
      .getByRole("region", { name: "Your monthly plan" })
      .getByRole("listitem"),
  ).toHaveCount(15);
  await page.getByText("Can I afford this?").click();
  const purchaseChecker = page.locator(".purchase-checker");
  await expect(
    purchaseChecker.getByLabel("What is it for?").locator("option"),
  ).toHaveCount(15);
  await purchaseChecker.getByLabel("Purchase amount").fill("75");
  await expect(
    purchaseChecker.getByText("This purchase fits your budget."),
  ).toBeVisible();
  await expect(
    purchaseChecker.getByText(
      "Groceries budget afterward: $175.00 · Available cash afterward: $925.00",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save plan" })).toHaveCount(0);

  await page.reload();
  const savedGroceries = page
    .getByRole("region", { name: "Your monthly plan" })
    .getByRole("listitem")
    .filter({ hasText: "Groceries" });
  await expect(savedGroceries).toContainText("$250.00");
  await expect(savedGroceries).not.toContainText("No spending history yet");
  await expect(
    page.getByRole("region", { name: "What are you planning?" }),
  ).toHaveCount(0);
  await expect(page.getByText("Available now")).toBeVisible();
  await expect(page.getByText("Spending budget")).toBeVisible();
  await expect(page.getByText("Total allocated")).toBeVisible();
  await page.getByRole("button", { name: "Edit monthly plan" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByLabel("Housing amount").fill("999");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("region", { name: "Your monthly plan" }),
  ).not.toContainText("$999.00");

  await page.goto("/");
  const nextSteps = page.getByRole("region", { name: "Money guidance" });
  await expect(nextSteps).toContainText("Finish a payment setup");
  await expect(nextSteps).toContainText("Credit card needs an amount or date.");
  await expect(
    nextSteps.getByRole("link", { name: "Add details" }),
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
    await page.getByRole("button", { name: "Record expense" }).click();
    await chooseFirstMoneyOption(page, "Account or card");
    await chooseMoneyOption(page, "Expense type", "Purchase");
    await chooseMoneyOption(page, "What was it for?", "Groceries");
    await page.getByLabel("Amount").fill(amount);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const transaction = page
      .getByRole("region", { name: "Recent transactions" })
      .getByRole("listitem")
      .filter({ hasText: `$${amount}.00` });
    await transaction.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    await dialog
      .getByLabel("Date", { exact: true })
      .fill(completedDate(monthsAgo));
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
  }

  await page.getByRole("button", { name: "Record expense" }).click();
  await chooseFirstMoneyOption(page, "Account or card");
  await chooseMoneyOption(page, "Expense type", "Purchase");
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await page.getByLabel("Amount").fill("75");
  await page.getByRole("button", { name: "Save", exact: true }).click();

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
  await page.getByLabel("Restaurants / eating out amount").fill("100");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("button", { name: "I do not have transportation costs" })
    .click();
  await page
    .getByRole("button", { name: "No health or personal-care amount" })
    .click();
  await page.getByRole("button", { name: "No education amount" }).click();
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
  await expect(groceries).toContainText("Typical: $150.00");
  await expect(
    page.getByRole("heading", { name: "Budget guidance" }),
  ).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Save plan" })).toHaveCount(0);
  await page.goto("/accounts");
  for (const [amount, monthsAgo] of [
    ["135", 2],
    ["141", 1],
  ] as const) {
    await page.getByRole("button", { name: "Record expense" }).click();
    await chooseFirstMoneyOption(page, "Account or card");
    await chooseMoneyOption(page, "Expense type", "Purchase");
    await chooseMoneyOption(
      page,
      "What was it for?",
      "Restaurants / eating out",
    );
    await page.getByLabel("Amount").fill(amount);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const transaction = page
      .getByRole("region", { name: "Recent transactions" })
      .getByRole("listitem")
      .filter({ hasText: `$${amount}.00` });
    await transaction.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    await dialog
      .getByLabel("Date", { exact: true })
      .fill(completedDate(monthsAgo));
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
  }
  await page.getByRole("button", { name: "Record expense" }).click();
  await chooseFirstMoneyOption(page, "Account or card");
  await chooseMoneyOption(page, "Expense type", "Purchase");
  await chooseMoneyOption(page, "What was it for?", "Restaurants / eating out");
  await page.getByLabel("Amount").fill("145");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await page.goto("/plan");
  const restaurants = page
    .getByRole("region", { name: "Your monthly plan" })
    .getByRole("listitem")
    .filter({ hasText: "Restaurants / eating out" });
  await expect(restaurants).toContainText("Spent this month: $145.00");
  await expect(restaurants).toContainText("Typical: $138.00");
  const guidance = page.getByRole("region", { name: "Budget guidance" });
  await expect(guidance).toContainText(
    "Restaurants / eating out: $145.00 spent of $100.00 planned.",
  );
  await page.goto("/");
  const donut = page.locator(".home-spending-donut");
  await expect(donut).toContainText("$220.00");
  await expect(donut.getByText(/%/)).toHaveCount(0);
  await expect(page.locator(".home-spending-budget-summary")).toContainText(
    "110% used",
  );
  await expect(page.locator(".home-spending-budget-summary")).toContainText(
    "$20.00 overall over",
  );
  await expect(page.locator(".home-category-warnings")).toContainText(
    "Category overages",
  );
});
