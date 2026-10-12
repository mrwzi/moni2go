import { expect, test, type Page } from "@playwright/test";

async function openBalanceUpdate(page: Page, accountName: string) {
  await page.getByLabel(`More actions for ${accountName}`).click();
  await page
    .getByRole("dialog", { name: `${accountName} account` })
    .getByRole("button", { name: "Update balance" })
    .click();
}

test("adds manual assets and liabilities and derives the home totals", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await expect(page.getByLabel("Account nickname")).toBeHidden();
  await page.getByLabel("Bank name").fill("Example Bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Bank name")).toBeHidden();
  await page.getByText("Add a nickname (optional)").click();
  await page.getByLabel("Account nickname").fill("Everyday chequing");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("1420.25");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("Account saved locally.")).toBeVisible();
  await expect(page.getByText("$1,420.25").first()).toBeVisible();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("credit-card");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("420.25");
  await page.getByLabel("Required payment amount").fill("35.00");
  await page.getByLabel("How often?").selectOption("biweekly");
  await page.getByLabel("Next payment date (optional)").fill("2099-10-18");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("−$420.25")).toHaveCount(0);
  await expect(page.getByText("$420.25").first()).toBeVisible();
  await expect(
    page.getByText("$35.00 every 2 weeks · next Oct 18, 2099"),
  ).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Your financial picture")).toBeVisible();
  await expect(page.getByText("$1,000.00")).toBeVisible();
  await expect(page.getByText("$1,420.25").first()).toBeVisible();
  await expect(page.getByText("$420.25").first()).toBeVisible();
});

test("keeps investments out of spendable cash", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page
    .getByLabel("What are you adding?")
    .selectOption("investment-platform");
  await page.getByLabel("Investment platform name").fill("Investment platform");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Account type", { exact: true }).selectOption("tfsa");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("5000");
  await page.getByLabel("Available to spend?").selectOption("non-cash");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("$5,000.00").first()).toBeVisible();
  await expect(page.getByText("$0.00").first()).toBeVisible();
});

test("updates an investment for dividends, losses, and missed changes", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page
    .getByLabel("What are you adding?")
    .selectOption("investment-platform");
  await page.getByLabel("Investment platform name").fill("Wealthsimple");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("1000");
  await page.getByLabel("Available to spend?").selectOption("non-cash");
  await page.getByRole("button", { name: "Save account" }).click();

  await openBalanceUpdate(page, "TFSA");
  await page.getByLabel("What changed?").selectOption("interest-dividend");
  await page.getByLabel("Amount").fill("25.50");
  await page.getByRole("button", { name: "Update balance" }).click();
  await expect(
    page.getByText("TFSA updated to $1,025.50 · Interest or dividend."),
  ).toBeVisible();

  await openBalanceUpdate(page, "TFSA");
  await page.getByLabel("What changed?").selectOption("loss");
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Update balance" }).click();
  await expect(
    page.getByText("TFSA updated to $925.50 · Investment or crypto loss."),
  ).toBeVisible();

  await openBalanceUpdate(page, "TFSA");
  await page.getByLabel("New current balance").fill("1500");
  await page.getByRole("button", { name: "Update balance" }).click();
  await expect(
    page.getByText("TFSA updated to $1,500.00 · Set current balance."),
  ).toBeVisible();
});

test("adds cash without asking for a place or account name", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("What are you adding?").selectOption("cash");

  await expect(page.getByLabel("Provider or place name")).toHaveCount(0);
  await expect(
    page.getByText("No name needed. Cash will appear as its own place."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Current value")).toBeVisible();
  await expect(page.getByLabel("Account type", { exact: true })).toHaveCount(0);

  await page.getByLabel("Current value").fill("60.50");
  await page.getByRole("button", { name: "Save account" }).click();

  await expect(page.getByText("Account saved locally.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cash" })).toBeVisible();
  await expect(page.getByText("$60.50").first()).toBeVisible();
});

test("adds a flexible debt without inventing a monthly payment", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("What are you adding?").selectOption("other");
  await page.getByLabel("Provider or place name").fill("Student loans");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("student-loan");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("3000");
  await page.getByLabel("Payment schedule").selectOption("flexible");

  await expect(page.getByLabel("Required payment amount")).toHaveCount(0);
  await expect(
    page.getByText("You choose when and how much to pay."),
  ).toBeVisible();

  await page.getByLabel("Target payoff date (optional)").fill("2099-10-31");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("Target Oct 31, 2099")).toBeVisible();
  await expect(page.getByText("Monthly payment missing")).toHaveCount(0);

  await page.goto("/plan");
  await expect(
    page.getByText("How much would you like to put toward flexible debt?"),
  ).toHaveCount(0);
  await expect(page.getByText("Step 1 of 13")).toBeVisible();
});

test("saves a paid-off credit card without inventing debt or a payment", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Example Bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("credit-card");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("0");

  await expect(page.getByLabel("Required payment amount")).toHaveCount(0);
  await expect(page.getByText("Nothing is due while")).toBeVisible();
  await expect(page.getByText("Your credit limit is not money")).toBeVisible();

  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("Account saved locally.")).toBeVisible();
  await expect(page.getByText("No balance owed")).toBeVisible();

  await page.getByRole("button", { name: "Money out" }).click();
  const spendingDialog = page.getByRole("dialog", { name: "Record spending" });
  await spendingDialog
    .getByRole("combobox", { name: "Account or card" })
    .selectOption({ label: "Credit card · owed $0.00" });
  await spendingDialog
    .getByLabel("What was it for?")
    .selectOption("subscriptions");
  await spendingDialog.getByLabel("Amount").fill("10");
  await spendingDialog.getByRole("button", { name: "Save purchase" }).click();

  await expect(
    page.getByText("$10.00 spending recorded from Credit card."),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("$10.00");
  await expect(page.getByText("No payment due recorded")).toBeVisible();

  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Finish your debt setup" }),
  ).toHaveCount(0);
});

test("offers a clear university or college debt path", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page
    .getByLabel("What are you adding?")
    .selectOption("education-provider");
  await page
    .getByLabel("Name of university or college")
    .fill("Example University");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("button", { name: "Money I owe" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Account type", { exact: true })).toHaveValue(
    "student-loan",
  );
  await expect(page.getByText("borrowed education funds")).toBeVisible();

  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("tuition-balance");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("1250");
  await page.getByLabel("Payment schedule").selectOption("flexible");
  await page.getByRole("button", { name: "Save account" }).click();

  await expect(page.getByText("Account saved locally.")).toBeVisible();
  await expect(
    page.getByText("Tuition owed to a school").first(),
  ).toBeVisible();
});

test("adds and completely removes a crypto provider", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("What are you adding?").selectOption("crypto-platform");
  await expect(
    page.getByText("Add the exchange or wallet first"),
  ).toBeVisible();
  await page.getByLabel("Crypto exchange or wallet name").fill("MEXC");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("button", { name: "Money I have" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Account type", { exact: true })).toHaveValue(
    "crypto",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("144.47");
  await page.getByRole("button", { name: "Save account" }).click();

  await expect(page.getByRole("heading", { name: "MEXC" })).toBeVisible();
  await expect(page.getByText("Crypto exchange or wallet")).toBeVisible();
  const cryptoMenu = page.getByLabel("More actions for Crypto");
  await cryptoMenu.click();
  await expect(
    page.getByRole("dialog", { name: "Crypto account" }),
  ).toBeVisible();
  await page.locator(".action-sheet-backdrop").click({
    position: { x: 5, y: 5 },
  });
  await expect(
    page.getByRole("dialog", { name: "Crypto account" }),
  ).toHaveCount(0);
  await cryptoMenu.click();
  await page.getByRole("button", { name: "Remove account" }).click();
  await expect(page.getByText("No accounts here yet.")).toBeVisible();
  await page.getByLabel("More provider actions for MEXC").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "MEXC" })).toHaveCount(0);
  await page.getByLabel("More provider actions for MEXC").click();
  await page.getByRole("button", { name: "Remove provider" }).click();

  await expect(page.getByRole("heading", { name: "MEXC" })).toHaveCount(0);
  await expect(page.getByText("MEXC removed.")).toBeVisible();
});

test("records money in and money out against an existing account", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Daily bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("100");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Money in" }).click();
  await page.getByLabel("Where did it come from?").selectOption("Gift");
  await page.getByLabel("Amount").fill("50.25");
  await page.getByRole("button", { name: "Add money", exact: true }).click();
  await expect(page.getByText("$50.25 added to Chequing.")).toBeVisible();
  await expect(page.getByText("$150.25").first()).toBeVisible();

  await page.getByRole("button", { name: "Money out" }).click();
  await page.getByLabel("What was it for?").selectOption("groceries");
  await page.getByLabel("Amount").fill("20.25");
  await page.getByRole("button", { name: "Save purchase" }).click();
  await expect(
    page.getByText("$20.25 spending recorded from Chequing."),
  ).toBeVisible();
  await expect(page.getByText("$130.00").first()).toBeVisible();

  await page.goto("/");
  const nextSteps = page.getByRole("region", { name: "Money guidance" });
  await expect(nextSteps).toBeVisible();
  await expect(nextSteps).toContainText("Start a simple plan");
  await expect(nextSteps).toContainText("Add your real bills and priorities");
});

test("records credit-card purchases once and applies payments to both balances", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Card bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("1000");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("credit-card");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("420");
  await page.getByLabel("Required payment amount").fill("35");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Money out" }).click();
  let spendingDialog = page.getByRole("dialog", { name: "Record spending" });
  await spendingDialog
    .getByRole("combobox", { name: "Account or card" })
    .selectOption({ label: "Credit card · owed $420.00" });
  await spendingDialog.getByLabel("What was it for?").selectOption("groceries");
  await spendingDialog.getByLabel("Amount").fill("50");
  await spendingDialog.getByRole("button", { name: "Save purchase" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("$470.00");

  await page.getByRole("button", { name: "Money out" }).click();
  spendingDialog = page.getByRole("dialog", { name: "Record spending" });
  await spendingDialog
    .getByLabel("What happened?")
    .selectOption("credit-card-payment");
  await spendingDialog
    .getByLabel("Credit card or debt paid")
    .selectOption({ label: "Credit card · owed $470.00" });
  await spendingDialog.getByLabel("Amount").fill("100");
  await spendingDialog.getByRole("button", { name: "Save payment" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: "Chequing" }),
  ).toContainText("$900.00");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("$370.00");
  const transactions = page.getByRole("region", {
    name: "Recent transactions",
  });
  await expect(transactions.getByText("Groceries")).toBeVisible();
  await expect(
    transactions.getByText("Card or loan payment", { exact: true }),
  ).toBeVisible();
});

test("adds and prioritizes a recurring household bill", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add bill" }).click();
  await page.getByLabel("Bill or membership name").fill("Family car loan");
  await page.getByLabel("Amount").fill("425");
  await page.getByLabel("Category").selectOption("transportation");
  await page.getByLabel("Priority").selectOption("required");
  await page.getByLabel("Due day each month", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Save bill" }).click();

  await expect(page.getByText("Family car loan")).toBeVisible();
  await expect(page.getByText("$425.00")).toBeVisible();
  await expect(page.getByText("Monthly · day 12")).toBeVisible();
  await expect(page.getByText("required", { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What needs attention" }),
  ).toBeVisible();
  await expect(page.getByText("Family car loan")).toBeVisible();
  await expect(page.getByText("Pay first")).toBeVisible();
  await expect(page.getByText("Expected commitments")).toBeVisible();
  await expect(page.getByText("These are in-app reminders.")).toBeVisible();

  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Your monthly plan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Transportation" }),
  ).toContainText("Saved bills: $425.00");
  await expect(
    page.getByText("This plan needs a change before saving."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save plan" })).toBeDisabled();
});

test("account form is usable without a pointer", async ({ page }) => {
  await page.goto("/accounts");
  const add = page.getByRole("button", { name: "+ Add provider" });
  await add.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Bank name").focus();
  await page.keyboard.type("Wallet");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Account type", { exact: true }).selectOption("cash");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Current value").focus();
  await page.keyboard.type("60.50");
  await page.getByRole("button", { name: "Save account" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Account saved locally.")).toBeVisible();
});
