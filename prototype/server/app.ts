import express from "express";
import { z } from "zod";

import { fundManagedWalletsCkb, getCkbFaucetStatus, getWalletCkbBalance } from "./ckb.js";
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
  parseUsdwAmount,
  transferUsdw,
  usdwReleaseFeeReserveShannons,
} from "./usdw.js";

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

const fundPocCkbSchema = z.object({
  adminId: z.string().min(1),
  amount: z.string().min(1).default("100"),
});

const fundPocUsdwSchema = z.object({
  adminId: z.string().min(1),
  account: z.enum(["business", "creator"]),
  amount: z.string().min(1),
});

function assertAdminUser(data: Awaited<ReturnType<typeof readStore>>, adminId: string) {
  const admin = data.users.find((user) => user.id === adminId);

  if (!admin || admin.role !== "admin") {
    throw new Error("Only a Werra admin can perform this action");
  }

  return admin;
}

async function assertBidHasFundingReady(bidId: string, businessId: string) {
  const data = await readStore();
  const bid = data.bids.find((item) => item.id === bidId);
  const brief = bid ? data.briefs.find((item) => item.id === bid.briefId) : undefined;
  const business = data.users.find((user) => user.id === businessId);
  const issuer = requirePocUser(data, "issuer");

  if (!bid || bid.status !== "PENDING" || !brief || brief.status !== "OPEN") {
    throw new Error("Awardable bid not found");
  }

  if (!business || business.id !== brief.businessId || business.role !== "business") {
    throw new Error("Only the brief SME can award and fund this bid");
  }

  const requiredUnits = parseUsdwAmount(bid.amountUsdi.toFixed(2));
  const balance = await getUsdwBalance(business.wallet, issuer.wallet);

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
  const issuer = requirePocUser(data, "issuer");

  if (!agreement || !escrow || agreement.status !== "DRAFT" || escrow.status !== "DRAFT") {
    throw new Error("Draft agreement escrow not found");
  }

  if (!business || business.id !== agreement.businessId || business.role !== "business") {
    throw new Error("Only the agreement SME can fund escrow");
  }

  const txHash = await transferUsdw({
    fromWallet: business.wallet,
    issuerWallet: issuer.wallet,
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
  const issuer = requirePocUser(data, "issuer");
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
    issuerWallet: issuer.wallet,
    outputs:
      input.decision === "release"
        ? [
            {
              wallet: creator.wallet,
              amountUnits: parseUsdwAmount(agreement.creatorPayoutUsdi.toFixed(2)),
            },
            {
              wallet: issuer.wallet,
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
          ckbPerWallet: "100",
          smeUsdw: "1000",
          creatorUsdw: "100",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/poc/fund-ckb", async (request, response, next) => {
    try {
      const input = fundPocCkbSchema.parse(request.body);
      const data = await readStore();
      assertAdminUser(data, input.adminId);

      const result = await fundManagedWalletsCkb([
        { wallet: requirePocUser(data, "business").wallet, amount: input.amount },
        { wallet: requirePocUser(data, "creator").wallet, amount: input.amount },
        { wallet: requirePocUser(data, "issuer").wallet, amount: input.amount },
        { wallet: requirePocUser(data, "escrow").wallet, amount: input.amount },
      ]);

      response.status(result.txHash ? 201 : 200).json({ ...result, amountCkb: input.amount });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/poc/fund-usdw", async (request, response, next) => {
    try {
      const input = fundPocUsdwSchema.parse(request.body);
      const data = await readStore();
      assertAdminUser(data, input.adminId);

      const issuer = requirePocUser(data, "issuer");
      const recipient = requirePocUser(data, input.account);
      const targetUnits = parseUsdwAmount(input.amount);
      const balance = await getUsdwBalance(recipient.wallet, issuer.wallet);

      if (BigInt(balance.amountUnits) >= targetUnits) {
        response.json({ txHash: null, issued: false, targetAmount: input.amount, account: input.account });
        return;
      }

      const txHash = await issueUsdw({
        issuerWallet: issuer.wallet,
        recipientWallet: recipient.wallet,
        amountUnits: targetUnits,
      });

      response.status(201).json({ txHash, issued: true, targetAmount: input.amount, account: input.account });
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
      const issuer = requirePocUser(data, "issuer");

      if (!user) {
        throw new Error("User not found");
      }

      response.json({ balance: await getUsdwBalance(user.wallet, issuer.wallet) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/usdw", async (_request, response, next) => {
    try {
      const data = await readStore();
      const issuer = requirePocUser(data, "issuer");
      response.json({ token: await getUsdwTokenInfo(issuer.wallet) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/usdw/issue", async (request, response, next) => {
    try {
      const input = issueUsdwSchema.parse(request.body);
      const data = await readStore();
      const issuer = requirePocUser(data, "issuer");
      const recipient = data.users.find((user) => user.id === input.recipientId);

      if (!recipient) {
        throw new Error("Recipient user not found");
      }

      const txHash = await issueUsdw({
        issuerWallet: issuer.wallet,
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
      const issuer = requirePocUser(data, "issuer");
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
        issuerWallet: issuer.wallet,
        outputs: [
          {
            wallet: creator.wallet,
            amountUnits: parseUsdwAmount(agreement.creatorPayoutUsdi.toFixed(2)),
          },
          {
            wallet: issuer.wallet,
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
