import express from "express";
import { z } from "zod";

import {
  getCkbFaucetStatus,
  getConfiguredFaucetWallet,
  getWalletCkbBalance,
  planManagedWalletsCkbFunding,
} from "./ckb.js";
import { config } from "./config.js";
import {
  awardBid,
  createBid,
  createBidSchema,
  createBrief,
  createBriefSchema,
  createDelivery,
  deliverySchema,
  disputeSchema,
  openDispute,
} from "./marketplace.js";
import { ensurePocWallets, listExistingPocWallets, requirePocUser } from "./poc.js";
import { readStore, updateStore } from "./store.js";
import { signupSchema, signupUser, toPublicUser } from "./users.js";
import {
  getUsdwBalance,
  getUsdwTokenInfo,
  issueUsdw,
  issueUsdwAndFundCkb,
  formatUsdwAmount,
  parseUsdwAmount,
  transferUsdw,
  type UsdwTransferOutput,
  usdwReleaseFeeReserveShannons,
} from "./usdw.js";
import type { ManagedWallet, User } from "./types.js";

type ManagedWalletUser = Pick<User, "id" | "wallet">;

const issueUsdwSchema = z.object({
  recipientId: z.string().min(1),
  amount: z.string().min(1),
});

const fundEscrowSchema = z.object({
  businessId: z.string().min(1),
});

const awardBidSchema = z.object({
  businessId: z.string().min(1),
});

const releaseEscrowSchema = z.object({
  approvedBy: z.string().min(1),
});

const settleDisputeSchema = z.object({
  adminId: z.string().min(1),
  decision: z.enum(["release", "refund"]),
});

const preparePocFundingSchema = z.object({
  userId: z.string().min(1),
  ckbAmount: z.string().min(1).default("500"),
  usdwAmount: z.string().min(1).default("1000"),
});

async function resolveUsdwIssuerWallet(data: Awaited<ReturnType<typeof readStore>>) {
  return (await getConfiguredFaucetWallet()) ?? requirePocUser(data, "issuer").wallet;
}

async function planUserUsdwTopUp(
  issuerWallet: ManagedWallet,
  user: ManagedWalletUser,
  amount: string,
) {
  const targetUnits = parseUsdwAmount(amount);
  const balance = await getUsdwBalance(user.wallet, issuerWallet);
  const currentUnits = BigInt(balance.amountUnits);

  if (currentUnits >= targetUnits) {
    return {
      result: {
        userId: user.id,
        txHash: null,
        issued: false,
        issuedAmount: "0",
        targetAmount: amount,
      },
    };
  }

  const amountUnits = targetUnits - currentUnits;

  return {
    result: {
      userId: user.id,
      txHash: null,
      issued: true,
      issuedAmount: formatUsdwAmount(amountUnits),
      targetAmount: amount,
    },
    output: {
      wallet: user.wallet,
      amountUnits,
    } satisfies UsdwTransferOutput,
  };
}

async function assertBidHasFundingReady(bidId: string, businessId: string) {
  const data = await readStore();
  const bid = data.bids.find((item) => item.id === bidId);
  const brief = bid ? data.briefs.find((item) => item.id === bid.briefId) : undefined;
  const business = data.users.find((user) => user.id === businessId);
  const issuerWallet = await resolveUsdwIssuerWallet(data);

  if (!bid || bid.status !== "PENDING" || !brief || brief.status !== "OPEN") {
    throw new Error("Awardable bid not found");
  }

  if (!business || business.id !== brief.businessId || business.role !== "business") {
    throw new Error("Only the brief SME can award and fund this bid");
  }

  const requiredUnits = parseUsdwAmount(bid.amountUsdi.toFixed(2));
  const balance = await getUsdwBalance(business.wallet, issuerWallet);

  if (BigInt(balance.amountUnits) < requiredUnits) {
    throw new Error("Insufficient USDW balance");
  }
}

async function fundDraftEscrow(agreementId: string, businessId: string) {
  const data = await readStore();
  const agreement = data.agreements.find((item) => item.id === agreementId);
  const escrow = data.escrows.find((item) => item.agreementId === agreementId);
  const business = data.users.find((user) => user.id === businessId);
  const escrowUser = requirePocUser(data, "escrow");
  const issuerWallet = await resolveUsdwIssuerWallet(data);

  if (!agreement || !escrow || agreement.status !== "DRAFT" || escrow.status !== "DRAFT") {
    throw new Error("Draft agreement escrow not found");
  }

  if (!business || business.id !== agreement.businessId || business.role !== "business") {
    throw new Error("Only the agreement SME can fund escrow");
  }

  const txHash = await transferUsdw({
    fromWallet: business.wallet,
    issuerWallet,
    outputs: [
      {
        wallet: escrowUser.wallet,
        amountUnits: parseUsdwAmount(agreement.creatorPayoutUsdi.toFixed(2)),
        capacityReserveShannons: usdwReleaseFeeReserveShannons,
      },
      {
        wallet: escrowUser.wallet,
        amountUnits: parseUsdwAmount(agreement.platformFeeUsdi.toFixed(2)),
        capacityReserveShannons: usdwReleaseFeeReserveShannons,
      },
    ],
  });

  let fundedAgreement = agreement;
  let fundedEscrow = escrow;
  const updatedAt = new Date().toISOString();

  await updateStore((current) => {
    fundedAgreement = { ...agreement, status: "FUNDED", updatedAt };
    fundedEscrow = { ...escrow, status: "FUNDED", fundingTxHash: txHash, updatedAt };

    return {
      ...current,
      agreements: current.agreements.map((item) => (item.id === agreement.id ? fundedAgreement : item)),
      escrows: current.escrows.map((item) => (item.id === escrow.id ? fundedEscrow : item)),
    };
  });

  return { txHash, agreement: fundedAgreement, escrow: fundedEscrow };
}

async function settleDispute(disputeId: string, input: z.infer<typeof settleDisputeSchema>) {
  const data = await readStore();
  const dispute = data.disputes.find((item) => item.id === disputeId);
  const agreement = dispute ? data.agreements.find((item) => item.id === dispute.agreementId) : undefined;
  const escrow = agreement ? data.escrows.find((item) => item.agreementId === agreement.id) : undefined;
  const admin = data.users.find((user) => user.id === input.adminId);
  const business = agreement ? data.users.find((user) => user.id === agreement.businessId) : undefined;
  const creator = agreement ? data.users.find((user) => user.id === agreement.creatorId) : undefined;
  const issuerWallet = await resolveUsdwIssuerWallet(data);
  const escrowUser = requirePocUser(data, "escrow");

  if (!dispute || dispute.status !== "OPEN") {
    throw new Error("Open dispute not found");
  }

  if (!agreement || !escrow || agreement.status !== "DISPUTED" || escrow.status !== "DISPUTED") {
    throw new Error("Disputed agreement escrow not found");
  }

  if (!admin || admin.role !== "admin") {
    throw new Error("Only a Werra admin can settle disputes");
  }

  if (!business || !creator) {
    throw new Error("Agreement parties not found");
  }

  const txHash = await transferUsdw({
    fromWallet: escrowUser.wallet,
    issuerWallet,
    outputs:
      input.decision === "release"
        ? [
            {
              wallet: creator.wallet,
              amountUnits: parseUsdwAmount(agreement.creatorPayoutUsdi.toFixed(2)),
            },
            {
              wallet: issuerWallet,
              amountUnits: parseUsdwAmount(agreement.platformFeeUsdi.toFixed(2)),
            },
          ]
        : [
            {
              wallet: business.wallet,
              amountUnits: parseUsdwAmount(agreement.grossUsdi.toFixed(2)),
            },
          ],
  });

  const resolvedAt = new Date().toISOString();
  const resolution = input.decision === "release" ? "RELEASED" : "REFUNDED";

  await updateStore((current) => ({
    ...current,
    agreements: current.agreements.map((item) =>
      item.id === agreement.id ? { ...item, status: resolution, updatedAt: resolvedAt } : item,
    ),
    escrows: current.escrows.map((item) =>
      item.id === escrow.id
        ? {
            ...item,
            status: resolution,
            releaseTxHash: input.decision === "release" ? txHash : item.releaseTxHash,
            refundTxHash: input.decision === "refund" ? txHash : item.refundTxHash,
            updatedAt: resolvedAt,
          }
        : item,
    ),
    disputes: current.disputes.map((item) =>
      item.id === dispute.id
        ? {
            ...item,
            status: "RESOLVED",
            resolvedAt,
            resolvedBy: admin.id,
            resolution,
            settlementTxHash: txHash,
          }
        : item,
    ),
  }));

  return { txHash, resolution };
}

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "werra-poc-api",
      network: config.chainNetwork,
      managedWallets: true,
      storeDriver: config.storeDriver,
      persistentStore: config.storeDriver === "postgres",
      defaultDevSecret: config.usingDefaultDevSecret,
      ckbGasSponsor: Boolean(config.ckbFaucetPrivateKey),
    });
  });

  app.get("/api/debug", (request, response) => {
    response.json({
      ok: true,
      route: "express /api/debug",
      method: request.method,
      originalUrl: request.originalUrl,
      url: request.url,
      path: request.path,
      host: request.headers.host,
      vercel: process.env.VERCEL === "1",
      environment: process.env.VERCEL_ENV,
      node: process.version,
      storeDriver: config.storeDriver,
      persistentStore: config.storeDriver === "postgres",
      hasDatabaseUrl: Boolean(config.postgresUrl),
      hasWalletEncryptionKey: !config.usingDefaultDevSecret,
      hasCkbGasSponsor: Boolean(config.ckbFaucetPrivateKey),
    });
  });

  app.get("/api/users", async (_request, response, next) => {
    try {
      const data = await readStore();
      response.json({ users: data.users.map(toPublicUser) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/poc/wallets", async (_request, response, next) => {
    try {
      const data = await readStore();
      response.json({ wallets: listExistingPocWallets(data) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/poc/wallets", async (_request, response, next) => {
    try {
      const wallets = await ensurePocWallets();
      response.status(201).json({ wallets });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/poc/funding", async (_request, response, next) => {
    try {
      response.json({
        ckbGasSponsor: await getCkbFaucetStatus(),
        recommended: {
          ckbPerWallet: "500",
          smeUsdw: "1000",
          creatorUsdw: "1000",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/poc/prepare-test-funds", async (request, response, next) => {
    try {
      const input = preparePocFundingSchema.parse(request.body ?? {});
      await ensurePocWallets();
      const data = await readStore();
      const user = data.users.find((item) => item.id === input.userId);
      const issuerWallet = await getConfiguredFaucetWallet();

      if (!issuerWallet) {
        throw new Error("CKB gas sponsorship is not configured for this deployment");
      }

      if (!user || (user.role !== "business" && user.role !== "creator")) {
        throw new Error("A signed-in SME or creator is required before funding a test wallet");
      }

      const ckbOutputs = await planManagedWalletsCkbFunding([
        { wallet: user.wallet, amount: input.ckbAmount },
        { wallet: requirePocUser(data, "escrow").wallet, amount: input.ckbAmount },
      ]);
      const usdwPlans = [await planUserUsdwTopUp(issuerWallet, user, input.usdwAmount)];
      const usdwOutputs = usdwPlans.flatMap((plan) => (plan.output ? [plan.output] : []));
      const txHash = await issueUsdwAndFundCkb({
        issuerWallet,
        ckbOutputs,
        usdwOutputs,
      });

      response.status(txHash ? 201 : 200).json({
        ckb: {
          txHash,
          fundedWallets: ckbOutputs.length,
          targetAmount: input.ckbAmount,
        },
        usdw: usdwPlans.map((plan) =>
          plan.output
            ? {
                ...plan.result,
                txHash,
              }
            : plan.result,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/:userId/ckb-balance", async (request, response, next) => {
    try {
      const data = await readStore();
      const user = data.users.find((item) => item.id === request.params.userId);

      if (!user) {
        throw new Error("User not found");
      }

      const balance = await getWalletCkbBalance(user.wallet);
      response.json({ balance });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/:userId/usdw-balance", async (request, response, next) => {
    try {
      const data = await readStore();
      const user = data.users.find((item) => item.id === request.params.userId);
      const issuerWallet = await resolveUsdwIssuerWallet(data);

      if (!user) {
        throw new Error("User not found");
      }

      response.json({ balance: await getUsdwBalance(user.wallet, issuerWallet) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/usdw", async (_request, response, next) => {
    try {
      const data = await readStore();
      const issuerWallet = await resolveUsdwIssuerWallet(data);
      response.json({ token: await getUsdwTokenInfo(issuerWallet) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/usdw/issue", async (request, response, next) => {
    try {
      const input = issueUsdwSchema.parse(request.body);
      const data = await readStore();
      const issuerWallet = await resolveUsdwIssuerWallet(data);
      const recipient = data.users.find((user) => user.id === input.recipientId);

      if (!recipient) {
        throw new Error("Recipient user not found");
      }

      const txHash = await issueUsdw({
        issuerWallet,
        recipientWallet: recipient.wallet,
        amountUnits: parseUsdwAmount(input.amount),
      });

      response.status(201).json({ txHash });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/marketplace", async (_request, response, next) => {
    try {
      const data = await readStore();
      response.json({
        briefs: data.briefs,
        bids: data.bids,
        agreements: data.agreements,
        escrows: data.escrows,
        deliveries: data.deliveries,
        disputes: data.disputes,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/signup", async (request, response, next) => {
    try {
      const input = signupSchema.parse(request.body);
      const user = await signupUser(input);
      response.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/briefs", async (request, response, next) => {
    try {
      const input = createBriefSchema.parse(request.body);
      const brief = await createBrief(input);
      response.status(201).json({ brief });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/briefs/:briefId/bids", async (request, response, next) => {
    try {
      const input = createBidSchema.parse(request.body);
      const bid = await createBid(request.params.briefId, input);
      response.status(201).json({ bid });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/bids/:bidId/award", async (request, response, next) => {
    try {
      const input = awardBidSchema.parse(request.body);
      await assertBidHasFundingReady(request.params.bidId, input.businessId);
      const result = await awardBid(request.params.bidId, input.businessId);

      if (!result.agreement) {
        throw new Error("Agreement was not created");
      }

      const funded = await fundDraftEscrow(result.agreement.id, input.businessId);
      response.status(201).json(funded);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agreements/:agreementId/fund-usdw-escrow", async (request, response, next) => {
    try {
      const input = fundEscrowSchema.parse(request.body);
      const result = await fundDraftEscrow(request.params.agreementId, input.businessId);
      response.status(201).json({ txHash: result.txHash });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agreements/:agreementId/release-usdw-escrow", async (request, response, next) => {
    try {
      const input = releaseEscrowSchema.parse(request.body);
      const data = await readStore();
      const agreement = data.agreements.find((item) => item.id === request.params.agreementId);
      const escrow = data.escrows.find((item) => item.agreementId === request.params.agreementId);
      const creator = agreement ? data.users.find((user) => user.id === agreement.creatorId) : undefined;
      const issuerWallet = await resolveUsdwIssuerWallet(data);
      const escrowUser = requirePocUser(data, "escrow");

      if (!agreement || !escrow || agreement.status !== "DELIVERED" || escrow.status !== "FUNDED") {
        throw new Error("Delivered funded agreement escrow not found");
      }

      if (input.approvedBy !== agreement.businessId) {
        throw new Error("Only the agreement SME can approve payout");
      }

      if (!creator) {
        throw new Error("Agreement creator not found");
      }

      const txHash = await transferUsdw({
        fromWallet: escrowUser.wallet,
        issuerWallet,
        outputs: [
          {
            wallet: creator.wallet,
            amountUnits: parseUsdwAmount(agreement.creatorPayoutUsdi.toFixed(2)),
          },
          {
            wallet: issuerWallet,
            amountUnits: parseUsdwAmount(agreement.platformFeeUsdi.toFixed(2)),
          },
        ],
      });

      await updateStore((current) => ({
        ...current,
        agreements: current.agreements.map((item) =>
          item.id === agreement.id
            ? { ...item, status: "RELEASED", updatedAt: new Date().toISOString() }
            : item,
        ),
        escrows: current.escrows.map((item) =>
          item.id === escrow.id
            ? { ...item, status: "RELEASED", releaseTxHash: txHash, updatedAt: new Date().toISOString() }
            : item,
        ),
      }));

      response.status(201).json({ txHash });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agreements/:agreementId/deliveries", async (request, response, next) => {
    try {
      const input = deliverySchema.parse(request.body);
      const delivery = await createDelivery(request.params.agreementId, input);
      response.status(201).json({ delivery });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agreements/:agreementId/disputes", async (request, response, next) => {
    try {
      const input = disputeSchema.parse(request.body);
      const dispute = await openDispute(request.params.agreementId, input);
      response.status(201).json({ dispute });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/disputes/:disputeId/settle", async (request, response, next) => {
    try {
      const input = settleDisputeSchema.parse(request.body);
      const result = await settleDispute(request.params.disputeId, input);
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (request, response) => {
    response.status(404).json({
      error: "API route not found",
      method: request.method,
      originalUrl: request.originalUrl,
      path: request.path,
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(400).json({ error: message });
  });

  return app;
}
