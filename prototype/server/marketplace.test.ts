import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { awardBid, createBid, createBrief, createDelivery } from "./marketplace";
import { readStore } from "./store";
import { signupUser } from "./users";

describe("marketplace backend flow", () => {
  it("returns the existing open brief for duplicate submit retries", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const business = await signupUser({ email: `duplicate-${suffix}@example.com`, role: "business" });
    const input = {
      businessId: business.id,
      title: "Cafe launch TikTok",
      category: "Food and restaurants",
      objective: "Drive store visits.",
      contentType: "Creator posted TikTok",
      deliverables: "1 video, 30-60 seconds",
      location: "Nairobi",
      platform: "TikTok",
      usageRights: "Organic reposting for 30 days",
      revisionCount: 1,
      budgetUsdi: 100,
      deadline: "2026-07-20",
    };

    const first = await createBrief(input);
    const retry = await createBrief({
      ...input,
      title: "  Cafe   launch TikTok  ",
    });
    const data = await readStore();
    const businessBriefs = data.briefs.filter((brief) => brief.businessId === business.id);

    assert.equal(retry?.id, first?.id);
    assert.equal(businessBriefs.length, 1);
  });

  it("creates an awarded agreement with stable hash material and draft escrow", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const business = await signupUser({ email: `brief-${suffix}@example.com`, role: "business" });
    const creator = await signupUser({ email: `creator-${suffix}@example.com`, role: "creator" });

    const brief = await createBrief({
      businessId: business.id,
      title: "Cafe launch TikTok",
      category: "Food and restaurants",
      objective: "Drive store visits.",
      contentType: "Creator posted TikTok",
      deliverables: "1 video, 30-60 seconds",
      location: "Nairobi",
      platform: "TikTok",
      usageRights: "Organic reposting for 30 days",
      revisionCount: 1,
      budgetUsdi: 100,
      deadline: "2026-07-20",
    });

    const bid = await createBid(brief!.id, {
      creatorId: creator.id,
      amountUsdi: 90,
      timeline: "3 days",
      pitch: "Location-first creator visit video.",
      sample: "Cafe launch reel",
    });

    const result = await awardBid(bid!.id);

    assert.equal(result.agreement?.status, "DRAFT");
    assert.equal(result.escrow?.status, "DRAFT");
    assert.match(result.agreement!.termsHash, /^0x[a-f0-9]{64}$/);
    assert.equal(result.agreement?.grossUsdi, 90);
    assert.equal(result.agreement?.platformFeeUsdi, 9);
    assert.equal(result.agreement?.creatorPayoutUsdi, 81);
  });

  it("blocks delivery before escrow is chain-confirmed funded", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const business = await signupUser({ email: `blocked-${suffix}@example.com`, role: "business" });
    const creator = await signupUser({ email: `blocked-creator-${suffix}@example.com`, role: "creator" });
    const brief = await createBrief({
      businessId: business.id,
      title: "Blocked delivery test",
      category: "Food and restaurants",
      objective: "Verify guarded delivery.",
      contentType: "Creator posted TikTok",
      deliverables: "1 video",
      location: "Nairobi",
      platform: "TikTok",
      usageRights: "Organic reposting for 30 days",
      revisionCount: 1,
      budgetUsdi: 100,
      deadline: "2026-07-20",
    });
    const bid = await createBid(brief!.id, {
      creatorId: creator.id,
      amountUsdi: 90,
      timeline: "3 days",
      pitch: "I can deliver.",
      sample: "Sample",
    });
    const result = await awardBid(bid!.id);

    await assert.rejects(
      () =>
        createDelivery(result.agreement!.id, {
          creatorId: creator.id,
          url: "https://tiktok.com/@creator/video/demo",
          note: "Delivered",
        }),
      /funded before delivery/,
    );
  });
});
