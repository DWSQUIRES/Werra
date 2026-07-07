import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("button", { name: /Continue as SME/ })).toBeVisible();
});

test("each role only sees its own workspace", async ({ page }) => {
  await page.getByRole("button", { name: /Continue as SME/ }).click();
  await expect(page.getByRole("button", { name: "Post Brief" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find Work" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Balances" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: /Continue as Creator/ }).click();
  await expect(page.getByRole("button", { name: "Find Work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post Brief" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Balances" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: /Continue as Werra Admin/ }).click();
  await expect(page.getByRole("button", { name: "Balances" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post Brief" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Find Work" })).toHaveCount(0);
});

test("public tester can prepare funded wallets before choosing a role", async ({ page }) => {
  let prepared = false;

  await page.route("**/api/poc/prepare-test-funds", async (route) => {
    prepared = true;
    await route.fulfill({
      status: 201,
      json: {
        ckb: { txHash: "0xckb", fundedWallets: 4, targetAmount: "500" },
        usdw: [
          { account: "business", txHash: "0xbusiness", issued: true, issuedAmount: "1000", targetAmount: "1000" },
          { account: "creator", txHash: "0xcreator", issued: true, issuedAmount: "1000", targetAmount: "1000" },
        ],
      },
    });
  });

  await page.getByRole("button", { name: "Prepare test wallets" }).click();
  await expect.poll(() => prepared).toBe(true);
  await expect(page.getByText("Workspace updated.")).toBeVisible();
});

test("SME posts a brief, creator applies, and SME awards the creator", async ({ page }) => {
  const title = `Playwright content brief ${Date.now()}`;

  await page.getByRole("button", { name: /Continue as SME/ }).click();
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
  await page.getByRole("button", { name: /Continue as Creator/ }).click();
  const briefPanel = page.locator(".panel").filter({ hasText: title });
  await expect(briefPanel).toHaveCount(1);
  await briefPanel.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Workspace updated.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: /Continue as SME/ }).click();
  await page.getByRole("button", { name: "Applications" }).click();
  const application = page.locator(".panel").filter({ hasText: title });
  await expect(application).toContainText("Demo Creator");
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
      email: "demo-sme@werra.local",
      role: "business",
      wallet: { address: "ckt1sme", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-creator",
      email: "demo-creator@werra.local",
      role: "creator",
      wallet: { address: "ckt1creator", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-admin",
      email: "demo-issuer@werra.local",
      role: "admin",
      wallet: { address: "ckt1admin", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
  ];

  await page.route("**/api/poc/wallets", async (route) => {
    await route.fulfill({
      json: {
        wallets: {
          business: { label: "Demo SME", user: users[0] },
          creator: { label: "Demo Creator", user: users[1] },
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

  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: /Continue as Creator/ }).click();
  await expect(page.getByText("Latest ready to deliver")).toBeVisible();
  await page.getByRole("button", { name: "Go to submit work" }).click();
  await expect(page.getByRole("heading", { name: "Funded creator delivery job" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Submit completed work" }).click();
  await expect(page.getByText("Delivery submitted")).toBeVisible();
});

test("admin can settle an open dispute in the support queue", async ({ page }) => {
  let resolved = false;
  const users = [
    {
      id: "usr-sme",
      email: "demo-sme@werra.local",
      role: "business",
      wallet: { address: "ckt1sme", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-creator",
      email: "demo-creator@werra.local",
      role: "creator",
      wallet: { address: "ckt1creator", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-admin",
      email: "demo-issuer@werra.local",
      role: "admin",
      wallet: { address: "ckt1admin", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
  ];

  await page.route("**/api/poc/wallets", async (route) => {
    await route.fulfill({
      json: {
        wallets: {
          business: { label: "Demo SME", user: users[0] },
          creator: { label: "Demo Creator", user: users[1] },
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
          amountUnits: "0",
          amount: "0",
          checkedAt: "2026-07-03T00:00:00.000Z",
        },
      },
    });
  });
  await page.route("**/api/marketplace", async (route) => {
    await route.fulfill({
      json: {
        briefs: [
          {
            id: "brf-disputed",
            businessId: "usr-sme",
            title: "Disputed launch reel",
            category: "Food and restaurants",
            objective: "Launch reel needs review.",
            contentType: "Creator posted short video",
            deliverables: "1 Instagram Reel",
            location: "Nairobi",
            platform: "Instagram",
            usageRights: "Organic reposting for 30 days",
            revisionCount: 1,
            budgetUsdi: 120,
            deadline: "2026-08-15",
            status: "AWARDED",
            createdAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        bids: [],
        agreements: [
          {
            id: "agr-disputed",
            briefId: "brf-disputed",
            bidId: "bid-disputed",
            businessId: "usr-sme",
            creatorId: "usr-creator",
            grossUsdi: 120,
            platformFeeUsdi: 12,
            creatorPayoutUsdi: 108,
            termsHash: "0xabc",
            canonicalTerms: "{}",
            status: resolved ? "REFUNDED" : "DISPUTED",
            createdAt: "2026-07-03T00:00:00.000Z",
            updatedAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        escrows: [
          {
            id: "esc-disputed",
            agreementId: "agr-disputed",
            status: resolved ? "REFUNDED" : "DISPUTED",
            createdAt: "2026-07-03T00:00:00.000Z",
            updatedAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        deliveries: [
          {
            id: "del-disputed",
            agreementId: "agr-disputed",
            creatorId: "usr-creator",
            url: "https://instagram.com/reel/werra-dispute",
            note: "Submitted final reel.",
            createdAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        disputes: resolved
          ? []
          : [
              {
                id: "dsp-open",
                agreementId: "agr-disputed",
                openedBy: "usr-sme",
                reason: "The delivery needs admin review.",
                status: "OPEN",
                createdAt: "2026-07-03T00:00:00.000Z",
              },
            ],
      },
    });
  });
  await page.route("**/api/disputes/dsp-open/settle", async (route) => {
    resolved = true;
    await route.fulfill({
      status: 201,
      json: {
        txHash: "0xsettled",
        resolution: "REFUNDED",
      },
    });
  });

  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: /Continue as Werra Admin/ }).click();
  await page.getByRole("button", { name: "Support" }).click();
  await expect(page.getByRole("heading", { name: "Disputed launch reel" })).toBeVisible();
  await expect(page.getByText("https://instagram.com/reel/werra-dispute")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay creator" })).toBeVisible();
  await page.getByRole("button", { name: "Refund SME" }).click();
  await expect(page.getByText("Workspace updated.")).toBeVisible();
  await expect(page.getByText("No open disputes")).toBeVisible();
});

test("admin can prepare public test funding from balances", async ({ page }) => {
  let gasFunded = false;
  const usdwAccounts: string[] = [];
  const users = [
    {
      id: "usr-sme",
      email: "demo-sme@werra.local",
      role: "business",
      wallet: { address: "ckt1sme", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-creator",
      email: "demo-creator@werra.local",
      role: "creator",
      wallet: { address: "ckt1creator", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-admin",
      email: "demo-issuer@werra.local",
      role: "admin",
      wallet: { address: "ckt1admin", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "usr-escrow",
      email: "demo-escrow@werra.local",
      role: "admin",
      wallet: { address: "ckt1escrow", publicKey: "0x", lockScript: {}, createdAt: "2026-07-03T00:00:00.000Z" },
      createdAt: "2026-07-03T00:00:00.000Z",
    },
  ];

  await page.route("**/api/poc/wallets", async (route) => {
    await route.fulfill({
      json: {
        wallets: {
          business: { label: "Demo SME", user: users[0] },
          creator: { label: "Demo Creator", user: users[1] },
          issuer: { label: "USDW issuer", user: users[2] },
          escrow: { label: "Werra escrow custody", user: users[3] },
        },
      },
    });
  });
  await page.route("**/api/users", async (route) => {
    await route.fulfill({ json: { users } });
  });
  await page.route("**/api/marketplace", async (route) => {
    await route.fulfill({ json: { briefs: [], bids: [], agreements: [], escrows: [], deliveries: [], disputes: [] } });
  });
  await page.route("**/api/users/*/usdw-balance", async (route) => {
    await route.fulfill({
      json: {
        balance: {
          symbol: "USDW",
          decimals: 6,
          amountUnits: "0",
          amount: "0",
          checkedAt: "2026-07-03T00:00:00.000Z",
        },
      },
    });
  });
  await page.route("**/api/users/*/ckb-balance", async (route) => {
    await route.fulfill({
      json: {
        balance: {
          capacityShannons: "0",
          capacityCkb: gasFunded ? "100" : "0",
          checkedAt: "2026-07-03T00:00:00.000Z",
          network: "testnet",
        },
      },
    });
  });
  await page.route("**/api/poc/funding", async (route) => {
    await route.fulfill({
      json: {
        ckbGasSponsor: {
          enabled: true,
          network: "testnet",
          address: "ckt1sponsor",
          capacityShannons: "1000000000000",
          capacityCkb: "10000",
          checkedAt: "2026-07-03T00:00:00.000Z",
        },
        recommended: {
          ckbPerWallet: "100",
          smeUsdw: "1000",
          creatorUsdw: "100",
        },
      },
    });
  });
  await page.route("**/api/poc/fund-ckb", async (route) => {
    gasFunded = true;
    await route.fulfill({ status: 201, json: { txHash: "0xgas", fundedWallets: 4, amountCkb: "100" } });
  });
  await page.route("**/api/poc/fund-usdw", async (route) => {
    const body = await route.request().postDataJSON();
    usdwAccounts.push(body.account);
    await route.fulfill({ status: 201, json: { txHash: `0x${body.account}`, issued: true, targetAmount: body.amount, account: body.account } });
  });

  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: /Continue as Werra Admin/ }).click();
  await page.getByRole("button", { name: "Balances" }).click();

  await expect(page.getByText("Managed test accounts")).toBeVisible();
  await expect(page.getByText("ckt1sme")).toBeVisible();

  const gasButton = page.getByRole("button", { name: "Fund CKB gas" });
  await expect(gasButton).toBeEnabled();
  await gasButton.click();
  await expect.poll(() => gasFunded).toBe(true);

  await page.getByRole("button", { name: "Add SME USDW" }).click();
  await page.getByRole("button", { name: "Add creator USDW" }).click();
  await expect.poll(() => usdwAccounts).toEqual(["business", "creator"]);
});
