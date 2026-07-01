import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("SME can award, fund escrow, review creator delivery, and release USDI payout", async ({ page }) => {
  await page.getByRole("button", { name: "Briefs" }).click();
  await page.getByText("I will shoot during lunch rush").waitFor();

  await page.getByRole("button", { name: "Award and draft escrow" }).first().click();
  await expect(page.getByText("Agreement and escrow")).toBeVisible();
  await expect(page.getByText("170.00 USDI")).toBeVisible();

  await page.getByRole("button", { name: "Fund escrow" }).click();
  await expect(page.getByText("USDI is locked. Creator can submit delivery.")).toBeVisible();
  await expect(page.getByTestId("business-wallet")).toContainText("1080.00 USDI");

  await page.getByRole("button", { name: "Creator" }).click();
  await page.getByRole("button", { name: "Workspace" }).click();
  await expect(page.getByRole("heading", { name: "2 TikToks for lunch burger offer" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Submit delivery" }).click();
  await expect(page.getByText("DELIVERED").first()).toBeVisible();

  await page.getByRole("button", { name: "SME" }).click();
  await page.getByRole("button", { name: "Escrow" }).click();
  await page.getByRole("button", { name: "Approve payout" }).click();

  await expect(page.getByText("RELEASED").first()).toBeVisible();
  await expect(page.getByTestId("creator-wallet")).toContainText("241.00 USDI");
  await expect(page.getByTestId("werra-wallet")).toContainText("17.00 USDI");
  await expect(page.getByText("Release tx")).toBeVisible();
});

test("SME can dispute delivered work and admin can refund escrow without double-paying", async ({ page }) => {
  await page.getByRole("button", { name: "Briefs" }).click();
  await page.getByRole("button", { name: "Award and draft escrow" }).first().click();
  await page.getByRole("button", { name: "Fund escrow" }).click();

  await page.getByRole("button", { name: "Creator" }).click();
  await page.getByRole("button", { name: "Workspace" }).click();
  await page.getByRole("button", { name: "Submit delivery" }).click();

  await page.getByRole("button", { name: "SME" }).click();
  await page.getByRole("button", { name: "Escrow" }).click();
  await page.getByRole("button", { name: "Dispute" }).click();

  await expect(page.getByText("Operations console")).toBeVisible();
  await expect(page.getByText("DISPUTED").first()).toBeVisible();
  await page.getByRole("button", { name: "Refund" }).click();

  await expect(page.getByText("REFUNDED").first()).toBeVisible();
  await expect(page.getByTestId("business-wallet")).toContainText("1250.00 USDI");
  await expect(page.getByTestId("creator-wallet")).toContainText("88.00 USDI");
  await expect(page.getByTestId("werra-wallet")).toContainText("0.00 USDI");
});
