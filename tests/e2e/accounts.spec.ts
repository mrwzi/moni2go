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
  await expect(
    page.getByRole("button", { name: /accounts for Example Bank/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Everyday chequing", { exact: true }),
  ).toBeVisible();
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

  await page.getByRole("button", { name: "Move money" }).click();
  const activity = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Another account I own (not tracked)");
  await activity.getByLabel("Amount").fill("35");
  await activity.getByText("Add a note").click();
  await activity.getByLabel("Note").fill("Business bank");
  await activity.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.getByText("$35.00 moved from Chequing to another account you own."),
  ).toBeVisible();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
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
    editDialog.getByRole("combobox", { name: "Account or card" }),
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

  await page.getByRole("button", { name: "Record expense" }).click();
  const account = page
    .getByRole("dialog", { name: "Record expense" })
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

  await page.getByRole("button", { name: "Add income" }).click();
  const addMoney = page.getByRole("dialog", { name: "Add income" });
  const addMoneyBox = await addMoney.boundingBox();
  await expect(
    addMoney.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();
  await addMoney.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Record expense" }).click();
  const activity = page.getByRole("dialog", { name: "Record expense" });
  const activityBox = await activity.boundingBox();
  if (!addMoneyBox || !activityBox)
    throw new Error("Money dialog bounds are unavailable");
  expect(Math.abs(addMoneyBox.width - activityBox.width)).toBeLessThan(1);
  await expect(
    activity.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();

  const typeSelector = activity.getByRole("combobox", {
    name: "Expense type",
  });
  await typeSelector.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(3);
  const menuBox = await page.getByRole("listbox").boundingBox();
  const typeBox = await typeSelector.boundingBox();
  if (!menuBox) throw new Error("Activity selector bounds are unavailable");
  if (!typeBox) throw new Error("Activity trigger bounds are unavailable");
  expect(menuBox.width).toBeLessThanOrEqual(activityBox.width);
  expect(Math.abs(menuBox.width - typeBox.width)).toBeLessThan(1);
  expect(menuBox.y).toBeGreaterThanOrEqual(typeBox.y + typeBox.height - 1);
  await page.keyboard.press("Escape");
  for (let opening = 0; opening < 3; opening += 1) {
    await typeSelector.click();
    const repeatedBox = await page.getByRole("listbox").boundingBox();
    if (!repeatedBox)
      throw new Error("Repeated selector bounds are unavailable");
    expect(Math.abs(repeatedBox.x - menuBox.x)).toBeLessThan(1);
    expect(Math.abs(repeatedBox.y - menuBox.y)).toBeLessThan(1);
    await page.keyboard.press("Escape");
  }
  await typeSelector.click();
  await page.getByRole("option", { name: "Refund", exact: true }).click();
  await expect(
    activity.getByRole("combobox", { name: "What was refunded?" }),
  ).toBeVisible();
  const originalViewport = page.viewportSize();
  if (!originalViewport) throw new Error("Viewport size is unavailable");
  await page.setViewportSize({ width: originalViewport.width, height: 480 });
  const categorySelector = activity.getByRole("combobox", {
    name: "What was refunded?",
  });
  await categorySelector.click();
  const upwardMenu = await page.getByRole("listbox").boundingBox();
  const categoryBox = await categorySelector.boundingBox();
  if (!upwardMenu || !categoryBox)
    throw new Error("Upward selector bounds are unavailable");
  expect(upwardMenu.y + upwardMenu.height).toBeLessThanOrEqual(
    categoryBox.y + 1,
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize(originalViewport);

  await expect(activity.getByLabel("Note (optional)")).toBeHidden();
  await activity.getByText("Add a note").click();
  await expect(activity.getByLabel("Note (optional)")).toBeVisible();
  await activity.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Move money" }).click();
  const moveDialog = page.getByRole("dialog", { name: "Move money" });
  const moveBox = await moveDialog.boundingBox();
  if (!moveBox) throw new Error("Move dialog bounds are unavailable");
  expect(Math.abs(addMoneyBox.width - moveBox.width)).toBeLessThan(1);
  await expect(
    moveDialog.getByRole("combobox", { name: "From" }),
  ).toBeVisible();
  await expect(moveDialog.getByRole("combobox", { name: "To" })).toBeVisible();
  await expect(
    moveDialog.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();
  await expect(
    moveDialog.getByRole("combobox", { name: "Expense type" }),
  ).toHaveCount(0);
  await moveDialog.getByRole("button", { name: "Close" }).click();

  await openBalanceUpdate(page, "Chequing");
  const balanceDialog = page.getByRole("dialog", { name: "Correct balance" });
  const balanceBox = await balanceDialog.boundingBox();
  if (!balanceBox) throw new Error("Balance dialog bounds are unavailable");
  expect(Math.abs(addMoneyBox.width - balanceBox.width)).toBeLessThan(1);
  await expect(
    balanceDialog.getByRole("button", { name: "Save", exact: true }),
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
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("TFSA updated to $1,025.50 · Interest or dividend."),
  ).toBeVisible();

  await openBalanceUpdate(page, "TFSA");
  await chooseMoneyOption(page, "What changed?", "Investment or crypto loss");
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("TFSA updated to $925.50 · Investment or crypto loss."),
  ).toBeVisible();

  await openBalanceUpdate(page, "TFSA");
  await page.getByLabel("New current balance").fill("1500");
  await page.getByRole("button", { name: "Save", exact: true }).click();
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

  await page.getByRole("button", { name: "Record expense" }).click();
  const spendingDialog = page.getByRole("dialog", { name: "Record expense" });
  await chooseMoneyOption(page, "Account or card", "Credit card · owed $0.00");
  await chooseMoneyOption(page, "What was it for?", "Subscriptions");
  await spendingDialog.getByLabel("Amount").fill("10");
  await spendingDialog
    .getByRole("button", { name: "Save", exact: true })
    .click();

  await expect(
    page.getByText("$10.00 spending recorded from Credit card."),
  ).toBeVisible();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
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
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
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

  await page.getByRole("button", { name: "Add income" }).click();
  const addMoneyDialog = page.getByRole("dialog", { name: "Add income" });
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
    .locator(".account-list > li")
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
    page.getByText("No spending recorded — activity may be incomplete."),
  ).toBeVisible();

  await page.goto("/accounts");
  await page.reload();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $13.23");

  await page.getByRole("button", { name: "Record expense" }).click();
  const activity = page.getByRole("dialog", { name: "Record expense" });
  await chooseMoneyOption(page, "Account or card", "Credit card · owed $13.23");
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await activity.getByLabel("Amount").fill("2");
  await activity.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $15.23");
  await expect(
    page
      .getByRole("region", { name: "Recent transactions" })
      .getByRole("listitem"),
  ).toHaveCount(1);

  await page.reload();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
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
  await expect(
    page.getByRole("region", { name: "Account totals" }),
  ).toContainText("$0.00");
  await page.getByText("More totals").click();
  await expect(
    page.getByRole("region", { name: "More account totals" }),
  ).toContainText("$144.47");
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

test("records received income once and optionally schedules future paydays", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Income bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("100");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Add income" }).click();
  const dialog = page.getByRole("dialog", { name: "Add income" });
  await expect(dialog).toContainText(
    "amount that actually reached your account",
  );
  await dialog.getByLabel("Amount").fill("500");
  await dialog.getByText("Future paydays").click();
  await dialog.getByLabel("Save a recurring payday schedule").check();
  await chooseMoneyOption(page, "How often?", "Every month");
  const nextPayday = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return `${date.getFullYear().toString()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
  });
  await dialog.getByLabel("Next expected payday").fill(nextPayday);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("$500.00 added to Chequing.")).toBeVisible();
  await expect(page.getByText("$600.00").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("$600.00").first()).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Financial outlook" }),
  ).toContainText("$500.00");
  await page.goto("/accounts");
  await page.getByText("Expected income").click();
  await page.getByRole("button", { name: "Remove schedule" }).click();
  await expect(
    page.getByText("Paycheque future schedule removed."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Expected income")).toHaveCount(0);
  await expect(page.getByText("$600.00").first()).toBeVisible();
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

  await page.getByRole("button", { name: "Add income" }).click();
  const incomeDialog = page.getByRole("dialog", { name: "Add income" });
  await chooseMoneyOption(page, "Income type", "Gift");
  await incomeDialog.getByLabel("Amount").fill("50.25");
  await incomeDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("$50.25 added to Chequing.")).toBeVisible();
  await expect(page.getByText("$150.25").first()).toBeVisible();

  await page.getByRole("button", { name: "Record expense" }).click();
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await page.getByLabel("Amount").fill("20.25");
  await page.getByText("Add a note").click();
  await page.getByLabel("Note (optional)").fill("Weekly supermarket trip");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("$20.25 spending recorded from Chequing."),
  ).toBeVisible();
  await expect(page.getByText("$130.00").first()).toBeVisible();
  await expect(page.getByText("Weekly supermarket trip")).toBeVisible();

  for (const amount of ["2", "3"]) {
    await page.getByRole("button", { name: "Record expense" }).click();
    await chooseMoneyOption(page, "What was it for?", "Subscriptions");
    await page.getByLabel("Amount").fill(amount);
    await page.getByRole("button", { name: "Save", exact: true }).click();
  }
  const history = page.getByRole("region", { name: "Recent transactions" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await history.getByRole("button", { name: "Show all activity (4)" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(4);
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
    "Forecasts cannot include income until an amount and date are saved",
  );
  const outlook = page.getByRole("region", { name: "Financial outlook" });
  await expect(outlook).toBeVisible();
  await expect(
    outlook.getByRole("button", { name: "30 days" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(outlook).toContainText(
    "Everyday spending is unknown and is not subtracted above.",
  );
  await expect(outlook).toContainText("Known projection");
  await expect(
    outlook.getByRole("link", { name: "Add bills or activity" }),
  ).toHaveAttribute("href", "/accounts");
  await expect(
    outlook.getByText(/The periods match because/),
  ).not.toBeVisible();
  await outlook.getByText("More details").click();
  await expect(outlook.getByText(/The periods match because/)).toBeVisible();
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

  await page.getByRole("button", { name: "Record expense" }).click();
  let spendingDialog = page.getByRole("dialog", { name: "Record expense" });
  await chooseMoneyOption(
    page,
    "Account or card",
    "Credit card · owed $420.00",
  );
  await chooseMoneyOption(page, "What was it for?", "Groceries");
  await spendingDialog.getByLabel("Amount").fill("50");
  await spendingDialog
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
  ).toContainText("$470.00");

  await page.getByRole("button", { name: "Move money" }).click();
  spendingDialog = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Credit card · owed $470.00");
  await spendingDialog.getByLabel("Amount").fill("500");
  await spendingDialog
    .getByRole("button", { name: "Save", exact: true })
    .click();

  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$500.00");
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
  ).toContainText("Credit $30.00");
  const transactions = page.getByRole("region", {
    name: "Recent transactions",
  });
  await expect(transactions.getByText("Groceries")).toBeVisible();
  await expect(
    transactions.getByText("Card or loan payment", { exact: true }),
  ).toBeVisible();
});

test("moves money between tracked accounts and into savings without changing spending", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Transfer bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("500");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("savings");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("100");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Move money" }).click();
  const move = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Savings · $100.00");
  await move.getByLabel("Amount").fill("75");
  await move.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$425.00");
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByText("Savings", { exact: true }) }),
  ).toContainText("$175.00");
  await expect(
    page.getByRole("region", { name: "Recent transactions" }),
  ).toContainText("Savings or investment deposit");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Spending at a glance" }),
  ).toBeVisible();
  await expect(
    page.getByText("No spending recorded — activity may be incomplete."),
  ).toBeVisible();
});

test("reduces cash and tracked loan debt with one simple payment", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Loan bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("500");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("personal-loan");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("1000");
  await page.getByLabel("Required payment amount").fill("100");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Move money" }).click();
  let move = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Personal loan · owed $1,000.00");
  await move.getByLabel("Amount").fill("100");
  await expect(move).toContainText(
    "manually reduces both cash and the tracked debt",
  );
  await move.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Personal loan" }),
  ).toContainText("Owed $900.00");

  await page.getByRole("button", { name: "Move money" }).click();
  move = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Personal loan · owed $900.00");
  await move.getByLabel("Amount").fill("50");
  await move.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Personal loan" }),
  ).toContainText("Owed $850.00");

  const unknownPayment = page
    .getByRole("region", { name: "Recent transactions" })
    .getByRole("listitem")
    .filter({ hasText: "$50.00" });
  await expect(unknownPayment).toContainText(
    "Loan bank · Chequing → Loan bank · Personal loan",
  );
  await unknownPayment.getByRole("button", { name: /Edit/ }).click();
  const editPayment = page.getByRole("dialog", { name: "Edit transaction" });
  await editPayment.getByLabel("Amount").fill("40");
  await editPayment.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$360.00");
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Personal loan" }),
  ).toContainText("Owed $860.00");
});

test("home spending and outlook stay readable from 320px through desktop", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Responsive bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("500");
  await page.getByRole("button", { name: "Save account" }).click();
  await page.getByRole("button", { name: "Record expense" }).click();
  const expense = page.getByRole("dialog", { name: "Record expense" });
  await chooseMoneyOption(page, "What was it for?", "Restaurants / eating out");
  await expense.getByLabel("Amount").fill("25");
  await expense.getByRole("button", { name: "Save", exact: true }).click();
  await page.goto("/");

  for (const width of [320, 360, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const donut = page.locator(".home-spending-donut");
    const amount = donut.getByText("$25.00", { exact: true });
    const breakdown = page.locator(".home-spending-breakdown");
    await expect(amount).toBeVisible();
    await expect(
      page.getByText("Restaurants / eating out", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("None scheduled", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/% of budget/)).toHaveCount(0);
    const [donutBox, amountBox, breakdownBox] = await Promise.all([
      donut.boundingBox(),
      amount.boundingBox(),
      breakdown.boundingBox(),
    ]);
    if (!donutBox || !amountBox || !breakdownBox)
      throw new Error(
        `Home layout bounds unavailable at ${width.toString()}px`,
      );
    expect(amountBox.x).toBeGreaterThan(donutBox.x + 8);
    expect(amountBox.x + amountBox.width).toBeLessThan(
      donutBox.x + donutBox.width - 8,
    );
    if (width <= 520)
      expect(breakdownBox.y).toBeGreaterThanOrEqual(
        donutBox.y + donutBox.height - 1,
      );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("adds and prioritizes a recurring household bill", async ({ page }) => {
  const longPaymentName =
    "Family transportation loan with an unusually long account name";
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("Bills bank");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("1000");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Add bill" }).click();
  await page.getByLabel("Bill name").fill(longPaymentName);
  await page.getByLabel("Amount").fill("425");
  await expect(
    page.getByRole("combobox", { name: "Payment priority" }),
  ).toContainText("Flexible");
  await chooseMoneyOption(page, "Category", "Transportation");
  await chooseMoneyOption(page, "Payment priority", "Required — must be paid");
  await page.getByLabel("Due day each month", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText(longPaymentName)).toBeVisible();
  await expect(page.getByText("$425.00")).toBeVisible();
  await expect(page.getByText("Monthly · day 12")).toBeVisible();
  await expect(page.getByText("required", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("dialog", { name: "Edit bill" })).toBeVisible();
  await page.getByLabel("Amount").fill("400");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("$400.00")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("paused", { exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(longPaymentName)).toHaveCount(0);
  await page.goto("/accounts#bills-commitments");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(`${longPaymentName} removed.`)).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(longPaymentName)).toBeVisible();

  await page.getByRole("button", { name: "Record expense" }).click();
  await chooseMoneyOption(
    page,
    "Saved bill (optional)",
    `${longPaymentName} · $400.00`,
  );
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("$100.00 spending recorded from Chequing."),
  ).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  const payments = page.getByRole("region", { name: "Payments" });
  await expect(payments).toContainText(longPaymentName);
  await expect(payments).toContainText("$300.00");
  await expect(payments).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("region", { name: "Financial outlook" }),
  ).toContainText("$300.00");

  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Your monthly plan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Transportation" }),
  ).toContainText("Saved bills: $400.00");
  await expect(page.getByText(/Your plan is .* too high\./)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save plan" })).toHaveCount(0);

  await page.goto("/accounts");
  await page.getByRole("button", { name: "Record expense" }).click();
  await chooseMoneyOption(
    page,
    "Saved bill (optional)",
    `${longPaymentName} · $400.00`,
  );
  await page.getByLabel("Amount").fill("300");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.goto("/");
  await expect(page.getByText(longPaymentName)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Spending at a glance" }),
  ).toContainText("$400.00");

  await page.goto("/accounts#bills-commitments");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await page.goto("/plan");
  await expect(page.getByText("Saved bills: $400.00")).toHaveCount(0);
});

test("uses the selected weekday for weekly bills", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add bill" }).click();
  await page.getByLabel("Bill name").fill("Friday membership");
  await page.getByLabel("Amount").fill("25");
  await chooseMoneyOption(page, "How often?", "Every week");
  await chooseMoneyOption(page, "Payment day", "Friday");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Friday membership" }),
  ).toContainText("Friday");
  await page.reload();
  await expect(page.getByText("Friday membership")).toBeVisible();
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

test("records, edits, and safely reverses money sent to someone", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("BMO");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("100");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Record expense" }).click();
  const expense = page.getByRole("dialog", { name: "Record expense" });
  await chooseMoneyOption(page, "Expense type", "Send money to someone");
  await chooseMoneyOption(page, "Purpose", "Gift");
  await chooseMoneyOption(page, "What was it for?", "Other");
  await expense.getByLabel("Amount").fill("25");
  await expense.getByText("Add a note").click();
  await expense.getByLabel("Note (optional)").fill("Alex birthday");
  await expense.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$75.00");
  const history = page.getByRole("region", { name: "Recent transactions" });
  const row = history.getByRole("listitem").filter({ hasText: "Gift sent" });
  await expect(row).toContainText("BMO · Chequing");
  await row.getByRole("button", { name: "Edit Gift sent transaction" }).click();

  const edit = page.getByRole("dialog", { name: "Edit transaction" });
  await edit.getByLabel("Amount").fill("15");
  await edit.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$85.00");

  await history
    .getByRole("button", { name: "Delete Gift sent transaction" })
    .click();
  const remove = page.getByRole("alertdialog", { name: "Delete transaction?" });
  await remove
    .getByRole("button", { name: "Undo transaction and restore balances" })
    .click();
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$100.00");
  await expect(history.getByText("Gift sent")).toHaveCount(0);
});

test("edits an older loan payment after normal same-day activity but protects a later correction", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("Bank name").fill("BMO");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current value").fill("3000");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Account" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("credit-card");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("200");
  await page.getByLabel("Required payment amount").fill("25");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "+ Add provider" }).click();
  await page.getByLabel("What are you adding?").selectOption("other");
  await page.getByLabel("Provider or place name").fill("UW");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Money I owe" }).click();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("student-loan");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current amount owed").fill("2093.14");
  await page.getByLabel("Payment schedule").selectOption("flexible");
  await page.getByRole("button", { name: "Save account" }).click();

  await page.getByRole("button", { name: "Move money" }).click();
  let move = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Student loan · owed $2,093.14");
  await move.getByLabel("Amount").fill("750");
  await move.getByRole("button", { name: "Save", exact: true }).click();

  await page.getByRole("button", { name: "Move money" }).click();
  move = page.getByRole("dialog", { name: "Move money" });
  await chooseMoneyOption(page, "To", "Credit card · owed $200.00");
  await move.getByLabel("Amount").fill("90");
  await move.getByRole("button", { name: "Save", exact: true }).click();

  const history = page.getByRole("region", { name: "Recent transactions" });
  const loanPayment = history
    .getByRole("listitem")
    .filter({ hasText: "BMO · Chequing → UW · Student loan" });
  await loanPayment
    .getByRole("button", { name: "Edit Card or loan payment transaction" })
    .click();
  let edit = page.getByRole("dialog", { name: "Edit transaction" });
  await expect(edit.getByRole("button", { name: "Save" })).toBeEnabled();
  await edit.getByLabel("Amount").fill("700");
  await edit.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.locator(".account-list > li").filter({ hasText: "Chequing" }),
  ).toContainText("$2,210.00");
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Student loan" }),
  ).toContainText("Owed $1,393.14");
  await expect(
    page.locator(".account-list > li").filter({ hasText: "Credit card" }),
  ).toContainText("Owed $110.00");

  await openBalanceUpdate(page, "Chequing");
  const correction = page.getByRole("dialog", { name: "Correct balance" });
  await correction.getByLabel("New current balance").fill("2200");
  await correction.getByRole("button", { name: "Save", exact: true }).click();

  await loanPayment
    .getByRole("button", { name: "Edit Card or loan payment transaction" })
    .click();
  edit = page.getByRole("dialog", { name: "Edit transaction" });
  await expect(edit).toContainText(
    "This account was corrected after this transaction",
  );
  await expect(edit.getByRole("button", { name: "Save" })).toBeDisabled();
});
