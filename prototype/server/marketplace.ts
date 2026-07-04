import crypto from "node:crypto";
import { z } from "zod";

import { canonicalJson, hashTerms } from "./agreement";
import { updateStore } from "./store";
import type { Agreement, Bid, Brief, Delivery, Dispute, Escrow, StoreData, User } from "./types";

export const createBriefSchema = z.object({
  businessId: z.string().min(1),
  title: z.string().min(3),
  category: z.string().min(1),
  objective: z.string().min(3),
  contentType: z.string().min(1),
  deliverables: z.string().min(3),
  location: z.string().min(1),
  platform: z.string().min(1),
  usageRights: z.string().min(1),
  revisionCount: z.number().int().min(0).max(5),
  budgetUsdi: z.number().positive(),
  deadline: z.string().min(1),
});

export const createBidSchema = z.object({
  creatorId: z.string().min(1),
  amountUsdi: z.number().positive(),
  timeline: z.string().min(1),
  pitch: z.string().min(3),
  sample: z.string().min(1),
});

export const deliverySchema = z.object({
  creatorId: z.string().min(1),
  url: z.string().url(),
  note: z.string().min(1),
});

export const disputeSchema = z.object({
  openedBy: z.string().min(1),
  reason: z.string().min(3),
});

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function requireUser(data: StoreData, userId: string, role?: User["role"]) {
  const user = data.users.find((item) => item.id === userId);

  if (!user || (role && user.role !== role)) {
    throw new Error(role ? `${role} user not found` : "User not found");
  }

  return user;
}

function fee(amount: number) {
  return Math.round(amount * 0.1 * 100) / 100;
}

function normalizeBriefField(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isSameOpenBrief(brief: Brief, input: z.infer<typeof createBriefSchema>) {
  return (
    brief.status === "OPEN"
    && brief.businessId === input.businessId
    && normalizeBriefField(brief.title) === normalizeBriefField(input.title)
    && normalizeBriefField(brief.objective) === normalizeBriefField(input.objective)
    && normalizeBriefField(brief.deliverables) === normalizeBriefField(input.deliverables)
    && brief.budgetUsdi === input.budgetUsdi
    && brief.deadline === input.deadline
  );
}

export async function createBrief(input: z.infer<typeof createBriefSchema>) {
  let created: Brief | undefined;

  await updateStore((data) => {
    requireUser(data, input.businessId, "business");
    const existing = data.briefs.find((brief) => isSameOpenBrief(brief, input));

    if (existing) {
      created = existing;
      return data;
    }

    created = {
      id: id("brf"),
      ...input,
      status: "OPEN",
      createdAt: now(),
    };

    return {
      ...data,
      briefs: [...data.briefs, created],
    };
  });

  return created;
}

export async function createBid(briefId: string, input: z.infer<typeof createBidSchema>) {
  let created: Bid | undefined;

  await updateStore((data) => {
    requireUser(data, input.creatorId, "creator");
    const brief = data.briefs.find((item) => item.id === briefId);

    if (!brief || brief.status !== "OPEN") {
      throw new Error("Open brief not found");
    }

    if (data.bids.some((bid) => bid.briefId === briefId && bid.creatorId === input.creatorId)) {
      throw new Error("Creator has already bid on this brief");
    }

    created = {
      id: id("bid"),
      briefId,
      ...input,
      status: "PENDING",
      createdAt: now(),
    };

    return {
      ...data,
      bids: [...data.bids, created],
    };
  });

  return created;
}

export async function awardBid(bidId: string, businessId?: string) {
  let agreement: Agreement | undefined;
  let escrow: Escrow | undefined;

  await updateStore((data) => {
    const bid = data.bids.find((item) => item.id === bidId);
    const brief = bid ? data.briefs.find((item) => item.id === bid.briefId) : undefined;

    if (!bid || bid.status !== "PENDING" || !brief || brief.status !== "OPEN") {
      throw new Error("Awardable bid not found");
    }

    if (businessId && brief.businessId !== businessId) {
      throw new Error("Only the brief SME can award this bid");
    }

    const platformFeeUsdi = fee(bid.amountUsdi);
    const creatorPayoutUsdi = Math.round((bid.amountUsdi - platformFeeUsdi) * 100) / 100;
    const createdAt = now();
    const terms = {
      brief,
      bid,
      businessWallet: requireUser(data, brief.businessId, "business").wallet.address,
      creatorWallet: requireUser(data, bid.creatorId, "creator").wallet.address,
      grossUsdi: bid.amountUsdi,
      platformFeeUsdi,
      creatorPayoutUsdi,
      disputeModel: "admin-assisted-poc",
    };

    agreement = {
      id: id("agr"),
      briefId: brief.id,
      bidId: bid.id,
      businessId: brief.businessId,
      creatorId: bid.creatorId,
      grossUsdi: bid.amountUsdi,
      platformFeeUsdi,
      creatorPayoutUsdi,
      termsHash: hashTerms(terms),
      canonicalTerms: canonicalJson(terms),
      status: "DRAFT",
      createdAt,
      updatedAt: createdAt,
    };

    escrow = {
      id: id("esc"),
      agreementId: agreement.id,
      status: "DRAFT",
      createdAt,
      updatedAt: createdAt,
    };

    return {
      ...data,
      briefs: data.briefs.map((item) =>
        item.id === brief.id ? { ...item, status: "AWARDED" } : item,
      ),
      bids: data.bids.map((item) =>
        item.briefId !== brief.id
          ? item
          : { ...item, status: item.id === bid.id ? "SELECTED" : "DECLINED" },
      ),
      agreements: [...data.agreements, agreement],
      escrows: [...data.escrows, escrow],
    };
  });

  return { agreement, escrow };
}

export async function createDelivery(agreementId: string, input: z.infer<typeof deliverySchema>) {
  let delivery: Delivery | undefined;

  await updateStore((data) => {
    const agreement = data.agreements.find((item) => item.id === agreementId);
    const escrow = data.escrows.find((item) => item.agreementId === agreementId);

    if (!agreement || !escrow || escrow.status !== "FUNDED" || agreement.status !== "FUNDED") {
      throw new Error("Agreement must be funded before delivery");
    }

    if (agreement.creatorId !== input.creatorId) {
      throw new Error("Only the selected creator can submit delivery");
    }

    const createdAt = now();
    delivery = {
      id: id("del"),
      agreementId,
      creatorId: input.creatorId,
      url: input.url,
      note: input.note,
      createdAt,
    };

    return {
      ...data,
      deliveries: [...data.deliveries, delivery],
      agreements: data.agreements.map((item) =>
        item.id === agreementId ? { ...item, status: "DELIVERED", updatedAt: createdAt } : item,
      ),
    };
  });

  return delivery;
}

export async function openDispute(agreementId: string, input: z.infer<typeof disputeSchema>) {
  let dispute: Dispute | undefined;

  await updateStore((data) => {
    const agreement = data.agreements.find((item) => item.id === agreementId);
    const escrow = data.escrows.find((item) => item.agreementId === agreementId);

    if (!agreement || !escrow || agreement.status !== "DELIVERED" || escrow.status !== "FUNDED") {
      throw new Error("Only delivered funded agreements can be disputed");
    }

    const createdAt = now();
    dispute = {
      id: id("dsp"),
      agreementId,
      openedBy: input.openedBy,
      reason: input.reason,
      status: "OPEN",
      createdAt,
    };

    return {
      ...data,
      disputes: [...data.disputes, dispute],
      agreements: data.agreements.map((item) =>
        item.id === agreementId ? { ...item, status: "DISPUTED", updatedAt: createdAt } : item,
      ),
      escrows: data.escrows.map((item) =>
        item.agreementId === agreementId ? { ...item, status: "DISPUTED", updatedAt: createdAt } : item,
      ),
    };
  });

  return dispute;
}
