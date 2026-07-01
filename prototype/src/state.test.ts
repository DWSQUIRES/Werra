import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  awardBidState,
  createBriefState,
  fundEscrowState,
  getMetrics,
  initialState,
  openDisputeState,
  refundEscrowState,
  releaseEscrowState,
  requestRevisionState,
  submitBidState,
  submitDeliveryState,
} from "./state";

const brief = {
  title: "UGC video for skincare launch",
  category: "Fashion and beauty",
  objective: "Drive product awareness and WhatsApp orders.",
  contentType: "UGC video delivered to business",
  deliverables: "1 video, 30-60 seconds",
  location: "Nairobi",
  platform: "TikTok",
  usageRights: "Paid ads usage for 30 days",
  revisionCount: 1,
  budgetUsdi: 120,
  deadline: "2026-07-15",
};

const bid = {
  amountUsdi: 100,
  timeline: "3 days",
  pitch: "I will create a hook-led product demo and CTA for WhatsApp orders.",
  sample: "Skincare UGC ad",
};

describe("Werra prototype state flow", () => {
  it("runs the full happy path from brief to released payout", () => {
    let state = createBriefState(initialState, brief, "gig-test");
    assert.equal(state.gigs[0].id, "gig-test");
    assert.equal(state.gigs[0].status, "OPEN");

    state = submitBidState(state, "gig-test", bid, "bid-test", "creator-brian");
    assert.equal(state.bids[0].id, "bid-test");
    assert.equal(state.bids[0].status, "PENDING");

    state = awardBidState(state, "bid-test");
    const awardedGig = state.gigs.find((gig) => gig.id === "gig-test");
    const escrow = state.escrows.find((item) => item.gigId === "gig-test");
    assert.equal(awardedGig?.status, "AWARDED");
    assert.equal(awardedGig?.selectedCreatorId, "creator-brian");
    assert.equal(escrow?.status, "DRAFT");
    assert.equal(escrow?.grossUsdi, 100);

    state = fundEscrowState(state, escrow!.id);
    assert.equal(state.gigs.find((gig) => gig.id === "gig-test")?.status, "FUNDED");
    assert.equal(state.escrows.find((item) => item.id === escrow!.id)?.status, "FUNDED");
    assert.equal(state.wallets.businessUsdi, 1150);

    state = submitDeliveryState(
      state,
      "gig-test",
      "https://tiktok.com/@creator/video/123",
      "Delivered with product demo and CTA.",
    );
    assert.equal(state.gigs.find((gig) => gig.id === "gig-test")?.status, "DELIVERED");

    state = releaseEscrowState(state, escrow!.id);
    assert.equal(state.gigs.find((gig) => gig.id === "gig-test")?.status, "RELEASED");
    assert.equal(state.escrows.find((item) => item.id === escrow!.id)?.status, "RELEASED");
    assert.equal(state.wallets.creatorUsdi, 178);
    assert.equal(state.wallets.werraUsdi, 10);
    assert.equal(getMetrics(state).releasedUsdi, 90);
  });

  it("keeps invalid transitions from mutating escrow and wallet state", () => {
    let state = awardBidState(initialState, "bid-burger-amina");
    const escrow = state.escrows.find((item) => item.gigId === "gig-burger")!;

    const afterInvalidRelease = releaseEscrowState(state, escrow.id);
    assert.deepEqual(afterInvalidRelease.wallets, state.wallets);
    assert.equal(afterInvalidRelease.escrows.find((item) => item.id === escrow.id)?.status, "DRAFT");

    state = fundEscrowState(state, escrow.id);
    const afterDoubleFund = fundEscrowState(state, escrow.id);
    assert.equal(afterDoubleFund.wallets.businessUsdi, state.wallets.businessUsdi);

    const afterInvalidRefund = refundEscrowState(initialState, "escrow-boutique");
    assert.equal(afterInvalidRefund.wallets.businessUsdi, initialState.wallets.businessUsdi);
    assert.equal(afterInvalidRefund.escrows[0].status, "DRAFT");
  });

  it("supports revision and dispute resolution paths from delivered work", () => {
    let state = awardBidState(initialState, "bid-burger-amina");
    const escrow = state.escrows.find((item) => item.gigId === "gig-burger")!;

    state = fundEscrowState(state, escrow.id);
    state = submitDeliveryState(state, "gig-burger", "https://instagram.com/reel/demo", "First cut.");
    state = requestRevisionState(state, "gig-burger");
    assert.equal(state.gigs.find((gig) => gig.id === "gig-burger")?.status, "REVISION_REQUESTED");

    state = submitDeliveryState(state, "gig-burger", "https://instagram.com/reel/revised", "Revised cut.");
    state = openDisputeState(state, "gig-burger");
    assert.equal(state.gigs.find((gig) => gig.id === "gig-burger")?.status, "DISPUTED");
    assert.equal(state.escrows.find((item) => item.id === escrow.id)?.status, "DISPUTED");

    const refunded = refundEscrowState(state, escrow.id);
    assert.equal(refunded.gigs.find((gig) => gig.id === "gig-burger")?.status, "REFUNDED");
    assert.equal(refunded.wallets.businessUsdi, 1250);
  });
});
