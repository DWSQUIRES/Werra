export type UserRole = "business" | "creator" | "admin";

export type ManagedWallet = {
  address: string;
  publicKey: string;
  lockScript: {
    codeHash: string;
    hashType: string;
    args: string;
  };
  encryptedPrivateKey: string;
  createdAt: string;
};

export type User = {
  id: string;
  email: string;
  role: UserRole;
  wallet: ManagedWallet;
  createdAt: string;
};

export type StoreData = {
  users: User[];
  briefs: Brief[];
  bids: Bid[];
  agreements: Agreement[];
  escrows: Escrow[];
  deliveries: Delivery[];
  disputes: Dispute[];
};

export type PublicUser = Omit<User, "wallet"> & {
  wallet: Omit<ManagedWallet, "encryptedPrivateKey">;
};

export type BriefStatus = "OPEN" | "AWARDED" | "CANCELLED";

export type Brief = {
  id: string;
  businessId: string;
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
  status: BriefStatus;
  createdAt: string;
};

export type BidStatus = "PENDING" | "SELECTED" | "DECLINED" | "WITHDRAWN";

export type Bid = {
  id: string;
  briefId: string;
  creatorId: string;
  amountUsdi: number;
  timeline: string;
  pitch: string;
  sample: string;
  status: BidStatus;
  createdAt: string;
};

export type AgreementStatus =
  | "DRAFT"
  | "FUNDED"
  | "DELIVERED"
  | "REVISION_REQUESTED"
  | "DISPUTED"
  | "RELEASED"
  | "REFUNDED";

export type Agreement = {
  id: string;
  briefId: string;
  bidId: string;
  businessId: string;
  creatorId: string;
  grossUsdi: number;
  platformFeeUsdi: number;
  creatorPayoutUsdi: number;
  termsHash: string;
  canonicalTerms: string;
  status: AgreementStatus;
  createdAt: string;
  updatedAt: string;
};

export type EscrowStatus =
  | "DRAFT"
  | "FUNDING_PENDING"
  | "FUNDED"
  | "RELEASE_PENDING"
  | "RELEASED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "DISPUTED";

export type Escrow = {
  id: string;
  agreementId: string;
  status: EscrowStatus;
  fundingTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
  escrowOutPoint?: {
    txHash: string;
    index: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type Delivery = {
  id: string;
  agreementId: string;
  creatorId: string;
  url: string;
  note: string;
  createdAt: string;
};

export type Dispute = {
  id: string;
  agreementId: string;
  openedBy: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: "RELEASED" | "REFUNDED";
  settlementTxHash?: string;
};
