export type Role = "business" | "creator" | "admin";
export type Tab = "dashboard" | "briefs" | "marketplace" | "workspace" | "escrow" | "admin";

export type GigStatus =
  | "OPEN"
  | "AWARDED"
  | "FUNDED"
  | "DELIVERED"
  | "REVISION_REQUESTED"
  | "DISPUTED"
  | "RELEASED"
  | "REFUNDED";

export type EscrowStatus =
  | "DRAFT"
  | "FUNDING_PENDING"
  | "FUNDED"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

export type Creator = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  location: string;
  verified: "Identity" | "Portfolio" | "Pro";
  rating: number;
  completed: number;
  followers: string;
  avgViews: string;
  engagement: string;
  audience: string;
  rate: number;
  samples: string[];
};

export type Gig = {
  id: string;
  title: string;
  businessName: string;
  category: string;
  objective: string;
  contentType: string;
  deliverables: string;
  location: string;
  platform: string;
  usageRights: string;
  revisionCount: number;
  budgetUsdi: number;
  kesEstimate: number;
  deadline: string;
  status: GigStatus;
  selectedCreatorId?: string;
  deliveryUrl?: string;
  deliveryNote?: string;
  createdAt: string;
};

export type Bid = {
  id: string;
  gigId: string;
  creatorId: string;
  amountUsdi: number;
  timeline: string;
  pitch: string;
  sample: string;
  status: "PENDING" | "SELECTED" | "DECLINED";
};

export type Escrow = {
  id: string;
  agreementId: string;
  gigId: string;
  creatorId: string;
  grossUsdi: number;
  platformFeeUsdi: number;
  creatorPayoutUsdi: number;
  status: EscrowStatus;
  termsHash: string;
  escrowCell: string;
  fundingTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
  updatedAt: string;
};

export type Wallets = {
  businessUsdi: number;
  creatorUsdi: number;
  werraUsdi: number;
};

export type AppState = {
  gigs: Gig[];
  bids: Bid[];
  escrows: Escrow[];
  wallets: Wallets;
};

export type BriefForm = {
  title: string;
  category: string;
  objective: string;
  contentType: string;
  deliverables: string;
  location: string;
  platform: string;
  usageRights: string;
  revisionCount: number;
  budgetUsdi: number;
  deadline: string;
};

export type BidForm = {
  amountUsdi: number;
  timeline: string;
  pitch: string;
  sample: string;
};

export const storageKey = "werra-prototype-state-v1";
export const activeCreatorId = "creator-amina";

export const creators: Creator[] = [
  {
    id: "creator-amina",
    name: "Amina Otieno",
    handle: "@aminaeats",
    niche: "Food and local spots",
    location: "Nairobi",
    verified: "Pro",
    rating: 4.9,
    completed: 31,
    followers: "48K",
    avgViews: "18K",
    engagement: "7.8%",
    audience: "82% Kenya",
    rate: 120,
    samples: ["Street food review", "Cafe launch reel", "Lunch offer TikTok"],
  },
  {
    id: "creator-brian",
    name: "Brian Mwangi",
    handle: "@brianbuildsbrands",
    niche: "UGC ads and ecommerce",
    location: "Kiambu",
    verified: "Identity",
    rating: 4.7,
    completed: 19,
    followers: "21K",
    avgViews: "9K",
    engagement: "6.1%",
    audience: "76% Kenya",
    rate: 95,
    samples: ["Skincare UGC ad", "Shoe store review", "Unboxing hook test"],
  },
  {
    id: "creator-nia",
    name: "Nia Wanjiru",
    handle: "@nia.styles",
    niche: "Fashion and beauty",
    location: "Nairobi",
    verified: "Portfolio",
    rating: 4.8,
    completed: 24,
    followers: "36K",
    avgViews: "14K",
    engagement: "8.4%",
    audience: "79% Kenya",
    rate: 110,
    samples: ["Boutique try-on reel", "Salon visit", "GRWM campaign"],
  },
  {
    id: "creator-kojo",
    name: "Kojo Muli",
    handle: "@kojomoves",
    niche: "Events and nightlife",
    location: "Nairobi",
    verified: "Identity",
    rating: 4.6,
    completed: 15,
    followers: "29K",
    avgViews: "11K",
    engagement: "5.9%",
    audience: "71% Kenya",
    rate: 100,
    samples: ["Weekend event recap", "DJ night promo", "Ticket push reel"],
  },
];

export const initialState: AppState = {
  gigs: [
    {
      id: "gig-burger",
      title: "2 TikToks for lunch burger offer",
      businessName: "Mtaa Burger House",
      category: "Food and restaurants",
      objective: "Drive weekday lunch walk-ins around Westlands.",
      contentType: "Creator posted TikTok",
      deliverables: "2 videos, 30-45 seconds each, one hook variation per video",
      location: "Westlands, Nairobi",
      platform: "TikTok",
      usageRights: "Organic reposting for 30 days",
      revisionCount: 1,
      budgetUsdi: 180,
      kesEstimate: 23220,
      deadline: "2026-07-12",
      status: "OPEN",
      createdAt: "2026-07-01",
    },
    {
      id: "gig-boutique",
      title: "Reel for new boutique collection",
      businessName: "Kitenge Lane",
      category: "Fashion and beauty",
      objective: "Promote new weekend arrivals and generate Instagram DMs.",
      contentType: "Instagram Reel + Story",
      deliverables: "1 Reel and 3 Story frames, creator posts on own account",
      location: "CBD, Nairobi",
      platform: "Instagram",
      usageRights: "Organic reposting for 14 days",
      revisionCount: 1,
      budgetUsdi: 140,
      kesEstimate: 18060,
      deadline: "2026-07-09",
      status: "AWARDED",
      selectedCreatorId: "creator-nia",
      createdAt: "2026-06-29",
    },
  ],
  bids: [
    {
      id: "bid-burger-amina",
      gigId: "gig-burger",
      creatorId: "creator-amina",
      amountUsdi: 170,
      timeline: "3 days after visit",
      pitch:
        "I will shoot during lunch rush and make one value-led hook plus one taste-test hook.",
      sample: "Cafe launch reel",
      status: "PENDING",
    },
    {
      id: "bid-burger-kojo",
      gigId: "gig-burger",
      creatorId: "creator-kojo",
      amountUsdi: 150,
      timeline: "4 days",
      pitch:
        "I can frame it as a quick office lunch run and push the location angle.",
      sample: "Weekend event recap",
      status: "PENDING",
    },
    {
      id: "bid-boutique-nia",
      gigId: "gig-boutique",
      creatorId: "creator-nia",
      amountUsdi: 130,
      timeline: "2 days",
      pitch:
        "Try-on reel with three outfit transitions and a story poll for DMs.",
      sample: "Boutique try-on reel",
      status: "SELECTED",
    },
  ],
  escrows: [
    {
      id: "escrow-boutique",
      agreementId: "werra_agr_9K2F",
      gigId: "gig-boutique",
      creatorId: "creator-nia",
      grossUsdi: 130,
      platformFeeUsdi: 13,
      creatorPayoutUsdi: 117,
      status: "DRAFT",
      termsHash: "0x41f8a0d5f2b29dc88018cbf1f36a79cabc104ee46d39e9071b",
      escrowCell: "0x7ad2c9e3c8b074f16a",
      updatedAt: "2026-07-01 15:20",
    },
  ],
  wallets: {
    businessUsdi: 1250,
    creatorUsdi: 88,
    werraUsdi: 0,
  },
};

export function createBriefState(state: AppState, form: BriefForm, gigId = `gig-${Date.now()}`): AppState {
  const gig: Gig = {
    ...form,
    id: gigId,
    businessName: "Mtaa Burger House",
    kesEstimate: Math.round(form.budgetUsdi * 129),
    status: "OPEN",
    createdAt: "2026-07-01",
  };

  return {
    ...state,
    gigs: [gig, ...state.gigs],
  };
}

export function submitBidState(
  state: AppState,
  gigId: string,
  form: BidForm,
  bidId = `bid-${Date.now()}`,
  creatorId = activeCreatorId,
): AppState {
  const gig = state.gigs.find((item) => item.id === gigId);
  const duplicateBid = state.bids.some((bid) => bid.gigId === gigId && bid.creatorId === creatorId);

  if (!gig || gig.status !== "OPEN" || duplicateBid || form.amountUsdi <= 0 || !form.pitch.trim()) {
    return state;
  }

  const bid: Bid = {
    ...form,
    id: bidId,
    gigId,
    creatorId,
    status: "PENDING",
  };

  return {
    ...state,
    bids: [bid, ...state.bids],
  };
}

export function awardBidState(state: AppState, bidId: string): AppState {
  const bid = state.bids.find((item) => item.id === bidId);
  const gig = bid ? state.gigs.find((item) => item.id === bid.gigId) : undefined;

  if (!bid || !gig || bid.status !== "PENDING" || gig.status !== "OPEN") {
    return state;
  }

  const escrow: Escrow = {
    id: `escrow-${Date.now()}`,
    agreementId: `werra_agr_${randomCode(4)}`,
    gigId: bid.gigId,
    creatorId: bid.creatorId,
    grossUsdi: bid.amountUsdi,
    platformFeeUsdi: roundMoney(bid.amountUsdi * 0.1),
    creatorPayoutUsdi: roundMoney(bid.amountUsdi * 0.9),
    status: "DRAFT",
    termsHash: `0x${randomHex(56)}`,
    escrowCell: `0x${randomHex(20)}`,
    updatedAt: currentStamp(),
  };

  return {
    ...state,
    gigs: state.gigs.map((item) =>
      item.id === bid.gigId
        ? { ...item, status: "AWARDED", selectedCreatorId: bid.creatorId }
        : item,
    ),
    bids: state.bids.map((item) =>
      item.gigId !== bid.gigId
        ? item
        : { ...item, status: item.id === bid.id ? "SELECTED" : "DECLINED" },
    ),
    escrows: [escrow, ...state.escrows.filter((item) => item.gigId !== bid.gigId)],
  };
}

export function fundEscrowState(state: AppState, escrowId: string): AppState {
  const escrow = state.escrows.find((item) => item.id === escrowId);
  const gig = escrow ? state.gigs.find((item) => item.id === escrow.gigId) : undefined;

  if (!escrow || !gig || escrow.status !== "DRAFT" || gig.status !== "AWARDED") {
    return state;
  }

  if (state.wallets.businessUsdi < escrow.grossUsdi) {
    return state;
  }

  return {
    ...state,
    wallets: {
      ...state.wallets,
      businessUsdi: roundMoney(state.wallets.businessUsdi - escrow.grossUsdi),
    },
    gigs: state.gigs.map((item) =>
      item.id === escrow.gigId ? { ...item, status: "FUNDED" } : item,
    ),
    escrows: state.escrows.map((item) =>
      item.id === escrowId
        ? {
            ...item,
            status: "FUNDED",
            fundingTxHash: `0x${randomHex(64)}`,
            updatedAt: currentStamp(),
          }
        : item,
    ),
  };
}

export function submitDeliveryState(
  state: AppState,
  gigId: string,
  deliveryUrl: string,
  deliveryNote: string,
): AppState {
  const gig = state.gigs.find((item) => item.id === gigId);
  const escrow = state.escrows.find((item) => item.gigId === gigId);

  if (!gig || !escrow || escrow.status !== "FUNDED") {
    return state;
  }

  if (!["FUNDED", "REVISION_REQUESTED"].includes(gig.status) || !deliveryUrl.trim()) {
    return state;
  }

  return {
    ...state,
    gigs: state.gigs.map((item) =>
      item.id === gigId
        ? {
            ...item,
            status: "DELIVERED",
            deliveryUrl,
            deliveryNote,
          }
        : item,
    ),
  };
}

export function requestRevisionState(state: AppState, gigId: string): AppState {
  const gig = state.gigs.find((item) => item.id === gigId);

  if (!gig || gig.status !== "DELIVERED") {
    return state;
  }

  return {
    ...state,
    gigs: state.gigs.map((item) =>
      item.id === gigId ? { ...item, status: "REVISION_REQUESTED" } : item,
    ),
  };
}

export function openDisputeState(state: AppState, gigId: string): AppState {
  const gig = state.gigs.find((item) => item.id === gigId);
  const escrow = state.escrows.find((item) => item.gigId === gigId);

  if (!gig || !escrow || gig.status !== "DELIVERED" || escrow.status !== "FUNDED") {
    return state;
  }

  return {
    ...state,
    gigs: state.gigs.map((item) =>
      item.id === gigId ? { ...item, status: "DISPUTED" } : item,
    ),
    escrows: state.escrows.map((item) =>
      item.gigId === gigId ? { ...item, status: "DISPUTED", updatedAt: currentStamp() } : item,
    ),
  };
}

export function releaseEscrowState(state: AppState, escrowId: string): AppState {
  const escrow = state.escrows.find((item) => item.id === escrowId);
  const gig = escrow ? state.gigs.find((item) => item.id === escrow.gigId) : undefined;

  if (!escrow || !gig) {
    return state;
  }

  const canReleaseDelivered = escrow.status === "FUNDED" && gig.status === "DELIVERED";
  const canReleaseDispute = escrow.status === "DISPUTED" && gig.status === "DISPUTED";

  if (!canReleaseDelivered && !canReleaseDispute) {
    return state;
  }

  return {
    ...state,
    wallets: {
      ...state.wallets,
      creatorUsdi: roundMoney(state.wallets.creatorUsdi + escrow.creatorPayoutUsdi),
      werraUsdi: roundMoney(state.wallets.werraUsdi + escrow.platformFeeUsdi),
    },
    gigs: state.gigs.map((item) =>
      item.id === escrow.gigId ? { ...item, status: "RELEASED" } : item,
    ),
    escrows: state.escrows.map((item) =>
      item.id === escrowId
        ? {
            ...item,
            status: "RELEASED",
            releaseTxHash: `0x${randomHex(64)}`,
            updatedAt: currentStamp(),
          }
        : item,
    ),
  };
}

export function refundEscrowState(state: AppState, escrowId: string): AppState {
  const escrow = state.escrows.find((item) => item.id === escrowId);
  const gig = escrow ? state.gigs.find((item) => item.id === escrow.gigId) : undefined;

  if (!escrow || !gig || !["FUNDED", "DISPUTED"].includes(escrow.status)) {
    return state;
  }

  return {
    ...state,
    wallets: {
      ...state.wallets,
      businessUsdi: roundMoney(state.wallets.businessUsdi + escrow.grossUsdi),
    },
    gigs: state.gigs.map((item) =>
      item.id === escrow.gigId ? { ...item, status: "REFUNDED" } : item,
    ),
    escrows: state.escrows.map((item) =>
      item.id === escrowId
        ? {
            ...item,
            status: "REFUNDED",
            refundTxHash: `0x${randomHex(64)}`,
            updatedAt: currentStamp(),
          }
        : item,
    ),
  };
}

export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as AppState) : initialState;
  } catch {
    return initialState;
  }
}

export function getMetrics(state: AppState) {
  return {
    activeGigs: state.gigs.filter((gig) => !["RELEASED", "REFUNDED"].includes(gig.status)).length,
    pendingBids: state.bids.filter((bid) => bid.status === "PENDING").length,
    fundedUsdi: state.escrows
      .filter((escrow) => ["FUNDED", "DISPUTED"].includes(escrow.status))
      .reduce((sum, escrow) => sum + escrow.grossUsdi, 0),
    releasedUsdi: state.escrows
      .filter((escrow) => escrow.status === "RELEASED")
      .reduce((sum, escrow) => sum + escrow.creatorPayoutUsdi, 0),
  };
}

function randomHex(length: number) {
  const chars = "abcdef0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function randomCode(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function currentStamp() {
  return "2026-07-01 " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
