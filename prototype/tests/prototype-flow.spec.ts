import { expect, test, type Page } from "@playwright/test";

const sessionKey = "werra-session-email";

async function signIn(page: Page, role: "business" | "creator", email: string) {
  let preparedUserId = "";

  await page.route(
    "**/api/poc/prepare-test-funds",
    async (route) => {
      const body = route.request().postDataJSON();
      preparedUserId = body.userId;
      await route.fulfill({
        status: 201,
        json: {
          ckb: { txHash: "0xckb", fundedWallets: 2, targetAmount: "1500" },
          usdw: [{ userId: body.userId, txHash: "0xusdw", issued: true, issuedAmount: "1000", targetAmount: "1000" }],
        },
      });
    },
    { times: 1 },
  );

  await page.route("**/api/users/*/ckb-balance", async (route) => {
    await route.fulfill({
      json: {
        balance: {
          capacityShannons: "150000000000",
          capacityCkb: "1500",
          checkedAt: "2026-07-03T00:00:00.000Z",
          network: "testnet",
        },
      },
    });
  });

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: role === "business" ? /SME/ : /Creator/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Workspace ready.")).toBeVisible();

  return preparedUserId;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), sessionKey);
  await page.reload();
  await expect(page.getByText("Sign in with email")).toBeVisible();
});

test("email sign-in creates a managed user and prepares that user's test wallet", async ({ page }) => {
  const email = `sme-${Date.now()}@example.com`;
  const preparedUserId = await signIn(page, "business", email);

  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("CKB wallet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy CKB wallet address" })).toBeVisible();
  expect(preparedUserId).toMatch(/^usr_/);
});

test("each role only sees its own workspace", async ({ page }) => {
  await signIn(page, "business", `sme-role-${Date.now()}@example.com`);
  await expect(page.getByRole("button", { name: "Post Brief" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find Work" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Support" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Balances" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "creator", `creator-role-${Date.now()}@example.com`);
  await expect(page.getByRole("button", { name: "Find Work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post Brief" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Support" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Balances" })).toHaveCount(0);
});

test("SME posts a brief, creator applies, and SME awards the creator", async ({ page }) => {
  const stamp = Date.now();
  const businessEmail = `sme-flow-${stamp}@example.com`;
  const creatorEmail = `creator-flow-${stamp}@example.com`;
  const creatorName = creatorEmail.split("@")[0];
  const title = `Playwright content brief ${stamp}`;

  await signIn(page, "business", businessEmail);
  await page.getByRole("button", { name: "Post Brief" }).click();
  await page.getByLabel("Brief title").fill(title);
  await page.getByLabel("Goal").fill("Bring new lunch customers into the restaurant this week.");
  await page.getByLabel("Deliverables").fill("1 TikTok video and 1 Instagram Reel.");
  await page.getByLabel("Budget").fill("77");
  await page.getByRole("button", { name: "Post brief", exact: true }).dblclick();
  await expect(page.getByText("Brief posted")).toBeVisible();
  await expect(page.getByText(`${title} is live for creator applications.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Post another brief" })).toBeVisible();
  await expect(page.getByText("Workspace updated.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "creator", creatorEmail);
  const briefPanel = page.locator(".panel").filter({ hasText: title });
  await expect(briefPanel).toHaveCount(1);
  await briefPanel.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Workspace updated.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "business", businessEmail);
  await page.getByRole("button", { name: "Applications" }).click();
  const application = page.locator(".panel").filter({ hasText: title });
  await expect(application).toContainText(creatorName);
  await page.route("**/api/bids/*/award", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        agreement: {
          id: "agr-awarded-funded",
          briefId: "brf-awarded-funded",
          bidId: "bid-awarded-funded",
          businessId: "usr-sme",
          creatorId: "usr-creator",
          grossUsdi: 77,
          platformFeeUsdi: 7.7,
          creatorPayoutUsdi: 69.3,
          termsHash: "0xabc",
          canonicalTerms: "{}",
          status: "FUNDED",
          createdAt: "2026-07-03T00:00:00.000Z",
          updatedAt: "2026-07-03T00:00:00.000Z",
        },
        escrow: {
          id: "esc-awarded-funded",
          agreementId: "agr-awarded-funded",
          status: "FUNDED",
          fundingTxHash: "0xtx",
          createdAt: "2026-07-03T00:00:00.000Z",
          updatedAt: "2026-07-03T00:00:00.000Z",
        },
        txHash: "0xtx",
      },
    });
  });
  await application.getByRole("button", { name: "Award & fund" }).click();
  await expect(page.getByText("Workspace updated.")).toBeVisible();
});

test("creator can submit completed work for a funded job", async ({ page }) => {
  let delivered = false;
  const users = [
    {
      id: "usr-sme",
      email: "sme-funded@example.com",
      role: "business",
      wallet: { address: "ckt1sme", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-creator",
      email: "creator-funded@example.com",
      role: "creator",
      wallet: { address: "ckt1creator", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-issuer",
      email: "demo-issuer@werra.local",
      role: "admin",
      wallet: { address: "ckt1issuer", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
  ];

  await page.route("**/api/poc/wallets", async (route) => {
    await route.fulfill({
      json: {
        wallets: {
          issuer: { label: "USDW issuer", user: users[2] },
          escrow: null,
        },
      },
    });
  });
  await page.route("**/api/users", async (route) => {
    await route.fulfill({ json: { users } });
  });
  await page.route("**/api/users/*/usdw-balance", async (route) => {
    await route.fulfill({
      json: {
        balance: {
          symbol: "USDW",
          decimals: 6,
          amountUnits: "99000000",
          amount: "99",
          checkedAt: "2026-07-03T00:00:00.000Z",
        },
      },
    });
  });
  await page.route("**/api/users/*/ckb-balance", async (route) => {
    await route.fulfill({
      json: {
        balance: {
          capacityShannons: "150000000000",
          capacityCkb: "1500",
          checkedAt: "2026-07-03T00:00:00.000Z",
          network: "testnet",
        },
      },
    });
  });
  await page.route("**/api/marketplace", async (route) => {
    await route.fulfill({
      json: {
        briefs: [
          {
            id: "brf-funded",
            businessId: "usr-sme",
            title: "Funded creator delivery job",
            category: "Food and restaurants",
            objective: "Create one launch video.",
            contentType: "Creator posted short video",
            deliverables: "1 TikTok video",
            location: "Nairobi",
            platform: "TikTok",
            usageRights: "Organic reposting for 30 days",
            revisionCount: 1,
            budgetUsdi: 110,
            deadline: "2026-08-15",
            status: "AWARDED",
            createdAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        bids: [
          {
            id: "bid-funded",
            briefId: "brf-funded",
            creatorId: "usr-creator",
            amountUsdi: 110,
            timeline: "3 days",
            pitch: "I will deliver.",
            sample: "https://tiktok.com/sample",
            status: "SELECTED",
            createdAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        agreements: [
          {
            id: "agr-funded",
            briefId: "brf-funded",
            bidId: "bid-funded",
            businessId: "usr-sme",
            creatorId: "usr-creator",
            grossUsdi: 110,
            platformFeeUsdi: 11,
            creatorPayoutUsdi: 99,
            termsHash: "0xabc",
            canonicalTerms: "{}",
            status: delivered ? "DELIVERED" : "FUNDED",
            createdAt: "2026-07-03T00:00:00.000Z",
            updatedAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        escrows: [
          {
            id: "esc-funded",
            agreementId: "agr-funded",
            status: "FUNDED",
            createdAt: "2026-07-03T00:00:00.000Z",
            updatedAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        deliveries: delivered
          ? [
              {
                id: "del-funded",
                agreementId: "agr-funded",
                creatorId: "usr-creator",
                url: "https://tiktok.com/@werra-demo/video/delivery",
                note: "Done.",
                createdAt: "2026-07-03T00:00:00.000Z",
              },
            ]
          : [],
        disputes: [],
      },
    });
  });
  await page.route("**/api/agreements/agr-funded/deliveries", async (route) => {
    delivered = true;
    await route.fulfill({
      status: 201,
      json: {
        delivery: {
          id: "del-funded",
          agreementId: "agr-funded",
          creatorId: "usr-creator",
          url: "https://tiktok.com/@werra-demo/video/delivery",
          note: "Done.",
          createdAt: "2026-07-03T00:00:00.000Z",
        },
      },
    });
  });

  await page.evaluate(
    ({ key, email }) => localStorage.setItem(key, email),
    { key: sessionKey, email: users[1].email },
  );
  await page.goto("/");
  await expect(page.getByText("Latest ready to deliver")).toBeVisible();
  await page.getByRole("button", { name: "Go to submit work" }).click();
  await expect(page.getByRole("heading", { name: "Funded creator delivery job" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Submit completed work" }).click();
  await expect(page.getByText("Delivery submitted")).toBeVisible();
});
