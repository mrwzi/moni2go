import { expect, test, type Page } from "@playwright/test";

async function chooseMoneyOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function openBalanceUpdate(page: Page, accountName: string) {
  await page.getByLabel(`More actions for ${accountName}`).click();
  await page
    .getByRole("dialog", { name: `${accountName} account` })
    .getByRole("button", { name: "Correct balance" })
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
  await expect(page.getByText("$1,420.25").first()).toBeVisible();
  await expect(page.getByText("$420.25").first()).toBeVisible();
  await expect(page.getByText("$1,000.00")).toBeVisible();
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
  await page.getByText("More totals").click();
  await expect(page.getByText("$5,000.00").first()).toBeVisible();
  await expect(page.getByText("$0.00").first()).toBeVisible();
});

test("records a transfer to an owned account that is not tracked", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Personal bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("101");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Record activity" }).click();
  const activity = page.getByRole("dialog", { name: "Record activity" });
  await chooseMoneyOption(
    page,
    "What happened?",
    "Transferred between accounts I own",
  );
  await chooseMoneyOption(
    page,
    "Where did it go?",
    "Another account I own (not listed)",
  );
  await activity.getByLabel("Amount").fill("35");
  await activity.getByText("Add a note").click();
  await activity.getByLabel("Note").fill("Business bank");
  await activity.getByRole("button", { name: "Save transfer" }).click();

  await expect(
    page.getByText("$35.00 moved from Chequing to another account you own."),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Chequing" }),
  ).toContainText("$66.00");
  const transactions = page.getByRole("region", {
    name: "Recent transactions",
  });
  await expect(
    transactions.getByText("Transfer to untracked account"),
  ).toBeVisible();
  await expect(transactions.getByText("Business bank")).toBeVisible();

  await transactions
    .getByRole("button", {
      name: "Edit Transfer to untracked account transaction",
    })
    .click();
  const editDialog = page.getByRole("dialog", { name: "Edit transaction" });
  await expect(
    editDialog.getByText("Transfer between accounts."),
  ).toBeVisible();
  await expect(editDialog.getByLabel("What happened?")).toHaveCount(0);
  await expect(editDialog.getByLabel("Category")).toHaveCount(0);
});

test("distinguishes duplicate account names by provider", async ({ page }) => {
  await page.goto("/accounts");
  for (const [bank, balance] of [
    ["BMO", "76"],
    ["PC Finance", "428.20"],
  ] as const) {
    await page.getByRole("button", { name: "+ Add provider" }).click();
    await page.getByLabel("Bank name").fill(bank);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Current value").fill(balance);
    await page.getByRole("button", { name: "Save account" }).click();
  }

  await page.getByRole("button", { name: "Record activity" }).click();
  const account = page
    .getByRole("dialog", { name: "Record activity" })
    .getByRole("combobox", { name: "Account or card" });
  await account.click();
  await expect(
    page.getByRole("option", { name: "BMO · Chequing · $76.00" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "PC Finance · Chequing · $428.20" }),
  ).toBeVisible();
});

test("keeps money dialogs consistent and shows only relevant activity fields", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Dialog bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("250");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Record income" }).click();
  const addMoney = page.getByRole("dialog", { name: "Add money" });
  const addMoneyBox = await addMoney.boundingBox();
  await addMoney.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Record activity" }).click();
  const activity = page.getByRole("dialog", { name: "Record activity" });
  const activityBox = await activity.boundingBox();
  if (!addMoneyBox || !activityBox)
    throw new Error("Money dialog bounds are unavailable");
  expect(Math.abs(addMoneyBox.width - activityBox.width)).toBeLessThan(1);

  const typeSelector = activity.getByRole("combobox", {
    name: "What happened?",
  });
  await typeSelector.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(5);
  const menuBox = await page.getByRole("listbox").boundingBox();
  if (!menuBox) throw new Error("Activity selector bounds are unavailable");
  expect(menuBox.width).toBeLessThanOrEqual(activityBox.width);
  await page.getByRole("option", { name: "Got money back (refund)" }).click();
  await expect(
    activity.getByRole("combobox", { name: "What was refunded?" }),
  ).toBeVisible();

  await chooseMoneyOption(
    page,
    "What happened?",
    "Transferred between accounts I own",
  );
  await expect(
    activity.getByRole("combobox", { name: "Where did it go?" }),
  ).toBeVisible();
  await expect(
    activity.getByRole("combobox", { name: "What was refunded?" }),
  ).toHaveCount(0);

  await chooseMoneyOption(page, "What happened?", "Paid a credit card or loan");
  await expect(
    activity.getByRole("combobox", { name: "Pay this account" }),
  ).toContainText("No debt with a balance");

  await chooseMoneyOption(
    page,
    "What happened?",
    "Added to savings or investments",
  );
  await expect(
    activity.getByRole("combobox", { name: "Pay this account" }),
  ).toHaveCount(0);
  await expect(
    activity.getByRole("combobox", { name: "Where did it go?" }),
  ).toHaveCount(0);
  await expect(activity.getByLabel("Note (optional)")).toBeHidden();
  await activity.getByText("Add a note").click();
  await expect(activity.getByLabel("Note (optional)")).toBeVisible();
  await activity.getByRole("button", { name: "Close" }).click();

  await openBalanceUpdate(page, "Chequing");
  const balanceDialog = page.getByRole("dialog", { name: "Correct balance" });
  const balanceBox = await balanceDialog.boundingBox();
  if (!balanceBox) throw new Error("Balance dialog bounds are unavailable");
  expect(Math.abs(addMoneyBox.width - balanceBox.width)).toBeLessThan(1);
  await expect(
    balanceDialog.getByRole("button", { name: "Save corrected balance" }),
  ).toBeVisible();
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
  await chooseMoneyOption(page, "What changed?", "Interest or dividend");
  await page.getByLabel("Amount").fill("25.50");
  await page.getByRole("button", { name: "Save corrected balance" }).click();
  await expect(
    page.getByText("TFSA updated to $1,025.50 · Interest or dividend."),
  ).toBeVisible();

  await openBalanceUpdate(page, "TFSA");
  await chooseMoneyOption(page, "What changed?", "Investment or crypto loss");
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Save corrected balance" }).click();
  await expect(
    page.getByText("TFSA updated to $925.50 · Investment or crypto loss."),
  ).toBeVisible();

  await openBalanceUpdate(page, "TFSA");
  await page.getByLabel("New current balance").fill("1500");
  await page.getByRole("button", { name: "Save corrected balance" }).click();
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

  await page.getByRole("button", { name: "Record activity" }).click();
  const spendingDialog = page.getByRole("dialog", { name: "Record activity" });
  await chooseMoneyOption(page, "Account or card", "Credit card · owed $0.00");
  await chooseMoneyOption(page, "What was it for?", "Subscriptions");
  await spendingDialog.getByLabel("Amount").fill("10");
  await spendingDialog.getByRole("button", { name: "Save purchase" }).click();

  await expect(
    page.getByText("$10.00 spending recorded from Credit card."),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $10.00");
  await expect(page.getByText("No payment due recorded")).toBeVisible();

  await page.getByLabel("More actions for Credit card").click();
  await page.getByRole("button", { name: "Update debt details" }).click();
  const debtDialog = page.getByRole("dialog", { name: "Update debt details" });
  await expect(debtDialog.getByLabel("Payment status")).toHaveValue("flexible");
  await expect(
    debtDialog.getByText("No statement payment is recorded yet"),
  ).toBeVisible();
  await expect(debtDialog.getByLabel("Required payment amount")).toHaveCount(0);
  await debtDialog.getByLabel("Payment status").selectOption("required");
  await debtDialog.getByLabel("Required payment amount").fill("1000");
  await debtDialog.getByRole("button", { name: "Save account" }).click();
  await expect(
    page.getByText(
      "Debt updated to $10.00. The required payment was adjusted to the remaining balance.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("$10.00 every month");

  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Finish your debt setup" }),
  ).toHaveCount(0);
});

test("corrects a debt balance without inventing spending and keeps the correction", async ({
  page,
}, testInfo) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Card bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("0");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("credit-card");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("27.67");
  await page.getByLabel("Required payment amount").fill("20");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Record income" }).click();
  const addMoneyDialog = page.getByRole("dialog", { name: "Add money" });
  const addMoneyBox = await addMoneyDialog.boundingBox();
  await addMoneyDialog.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("More actions for Credit card").click();
  await page.getByRole("button", { name: "Update debt details" }).click();
  const debtDialog = page.getByRole("dialog", { name: "Update debt details" });
  await expect(debtDialog).toBeVisible();
  const debtDialogBox = await debtDialog.boundingBox();
  if (!addMoneyBox || !debtDialogBox)
    throw new Error("Debt dialog comparison bounds are unavailable");
  expect(Math.abs(addMoneyBox.width - debtDialogBox.width)).toBeLessThan(1);

  if (testInfo.project.name === "mobile-chromium") {
    const box = await debtDialog.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport)
      throw new Error("Debt dialog bounds are unavailable");
    expect(box.x).toBeGreaterThanOrEqual(15);
    expect(box.y).toBeGreaterThanOrEqual(15);
    expect(viewport.width - box.x - box.width).toBeGreaterThanOrEqual(15);
    expect(viewport.height - box.y - box.height).toBeGreaterThanOrEqual(15);
  }

  await debtDialog.getByLabel("Current amount owed").fill("13.23");
  await debtDialog.getByRole("button", { name: "Save account" }).click();

  await expect(page.getByText("Debt updated to $13.23.")).toBeVisible();
  const creditCard = page
    .getByRole("listitem")
    .filter({ hasText: "Credit card" });
  await expect(creditCard).toContainText("Owed $13.23");
  await expect(creditCard).toContainText("$13.23 every month");
  await expect(
    page.getByRole("region", { name: "Recent transactions" }),
  ).toHaveCount(0);

  await page.getByText("More totals").click();
  await expect(page.getByText("−$13.23")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("$13.23").first()).toBeVisible();
  await expect(page.getByText("−$13.23")).toBeVisible();
  await expect(
    page.getByText(
      "No spending has been recorded in moni2go this month. This does not mean no money was spent.",
    ),
  ).toBeVisible();

  await page.goto("/accounts");
  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $13.23");

  await page.getByRole("button", { name: "Record activity" }).click();
  const activity = page.getByRole("dialog", { name: "Record activity" });
  await chooseMoneyOption(page, "Account or card", "Credit card · owed $13.23");
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await activity.getByLabel("Amount").fill("2");
  await activity.getByRole("button", { name: "Save purchase" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $15.23");
  await expect(
    page
      .getByRole("region", { name: "Recent transactions" })
      .getByRole("listitem"),
  ).toHaveCount(1);

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $15.23");
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

  await page.getByRole("button", { name: "Record income" }).click();
  await chooseMoneyOption(page, "Where did it come from?", "Gift");
  await page.getByLabel("Amount").fill("50.25");
  await page.getByRole("button", { name: "Add money", exact: true }).click();
  await expect(page.getByText("$50.25 added to Chequing.")).toBeVisible();
  await expect(page.getByText("$150.25").first()).toBeVisible();

  await page.getByRole("button", { name: "Record activity" }).click();
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await page.getByLabel("Amount").fill("20.25");
  await page.getByText("Add a note").click();
  await page.getByLabel("Note (optional)").fill("Weekly supermarket trip");
  await page.getByRole("button", { name: "Save purchase" }).click();
  await expect(
    page.getByText("$20.25 spending recorded from Chequing."),
  ).toBeVisible();
  await expect(page.getByText("$130.00").first()).toBeVisible();
  await expect(page.getByText("Weekly supermarket trip")).toBeVisible();

  for (const amount of ["2", "3"]) {
    await page.getByRole("button", { name: "Record activity" }).click();
    await chooseMoneyOption(page, "What was it for?", "Subscriptions");
    await page.getByLabel("Amount").fill(amount);
    await page.getByRole("button", { name: "Save purchase" }).click();
  }
  const history = page.getByRole("region", { name: "Recent transactions" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await history.getByRole("button", { name: "Show all activity (3)" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(3);
  await expect(history.getByText("Weekly supermarket trip")).toBeVisible();

  await page.goto("/");
  const spendingChart = page.getByRole("region", {
    name: "Spending at a glance",
  });
  await expect(spendingChart).toContainText("$25.25");
  await expect(spendingChart).toContainText("Groceries");
  await expect(spendingChart).toContainText("Subscriptions");
  const nextSteps = page.getByRole("region", { name: "Money guidance" });
  await expect(nextSteps).toBeVisible();
  await expect(nextSteps).toContainText("Add expected income when you know it");
  await expect(nextSteps).toContainText(
    "future cash cannot include income until an amount and date are saved",
  );
  const outlook = page.getByRole("region", { name: "Financial outlook" });
  await expect(outlook).toBeVisible();
  await expect(
    outlook.getByRole("button", { name: "30 days" }),
  ).toHaveAttribute("aria-pressed", "true");
  await outlook.getByRole("button", { name: "90 days" }).click();
  await expect(
    outlook.getByRole("button", { name: "90 days" }),
  ).toHaveAttribute("aria-pressed", "true");
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

  await page.getByRole("button", { name: "Record activity" }).click();
  let spendingDialog = page.getByRole("dialog", { name: "Record activity" });
  await chooseMoneyOption(
    page,
    "Account or card",
    "Credit card · owed $420.00",
  );
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await spendingDialog.getByLabel("Amount").fill("50");
  await spendingDialog.getByRole("button", { name: "Save purchase" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("$470.00");

  await page.getByRole("button", { name: "Record activity" }).click();
  spendingDialog = page.getByRole("dialog", { name: "Record activity" });
  await chooseMoneyOption(page, "What happened?", "Paid a credit card or loan");
  await expect(
    spendingDialog.getByRole("combobox", { name: "Pay this account" }),
  ).toContainText("Credit card · owed $470.00");
  await spendingDialog.getByLabel("Amount").fill("500");
  await spendingDialog.getByRole("button", { name: "Save payment" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: "Chequing" }),
  ).toContainText("$500.00");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Credit card" }),
  ).toContainText("Credit $30.00");
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
    page.getByRole("heading", { name: "Required and upcoming" }),
  ).toBeVisible();
  await expect(page.getByText("Family car loan")).toBeVisible();
  await expect(page.getByText("Required", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Financial outlook" }),
  ).toContainText("$425.00");
  await expect(page.getByText("These are in-app reminders.")).toBeVisible();

  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Your monthly plan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Transportation" }),
  ).toContainText("Saved bills: $425.00");
  await expect(page.getByText(/Your plan is .* too high\./)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save plan" })).toHaveCount(0);
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
