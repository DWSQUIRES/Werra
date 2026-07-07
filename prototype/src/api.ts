export type ApiRole = "business" | "creator" | "admin";

export type ApiUser = {
  id: string;
  email: string;
  role: ApiRole;
  wallet: {
    address: string;
    publicKey: string;
    lockScript: unknown;
    createdAt: string;
  };
  createdAt: string;
};

export type ApiBrief = {
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
  status: string;
  createdAt: string;
};

export type ApiBid = {
  id: string;
  briefId: string;
  creatorId: string;
  amountUsdi: number;
  timeline: string;
  pitch: string;
  sample: string;
  status: string;
  createdAt: string;
};

export type ApiAgreement = {
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
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiEscrow = {
  id: string;
  agreementId: string;
  status: string;
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

export type ApiDelivery = {
  id: string;
  agreementId: string;
  creatorId: string;
  url: string;
  note: string;
  createdAt: string;
};

export type ApiDispute = {
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

export type ApiMarketplace = {
  briefs: ApiBrief[];
  bids: ApiBid[];
  agreements: ApiAgreement[];
  escrows: ApiEscrow[];
  deliveries: ApiDelivery[];
  disputes: ApiDispute[];
};

export type ApiPocFundingSetup = {
  ckb: {
    txHash: string | null;
    fundedWallets: number;
    targetAmount: string;
  };
  usdw: Array<{
    account: "business" | "creator";
    txHash: string | null;
    issued: boolean;
    issuedAmount: string;
    targetAmount: string;
  }>;
};

export type ApiUsdwBalance = {
  symbol: "USDW";
  decimals: number;
  amountUnits: string;
  amount: string;
  checkedAt: string;
};

export type ApiUsdwToken = {
  symbol: "USDW";
  name: string;
  decimals: number;
  issuerEmail: string;
  escrowEmail: string;
  ownerLockHash: string;
  issuerAddress: string;
  typeScript: {
    codeHash: string;
    hashType: string;
    args: string;
  };
};

export type ApiPocWalletKey = "business" | "creator" | "issuer" | "escrow";

export type ApiPocWallets = Record<
  ApiPocWalletKey,
  | {
      label: string;
      user: ApiUser;
    }
  | null
>;

export type CreateBriefInput = Omit<ApiBrief, "id" | "status" | "createdAt">;
export type CreateBidInput = Omit<ApiBid, "id" | "briefId" | "status" | "createdAt">;

const jsonHeaders = {
  "Content-Type": "application/json",
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text.slice(0, 180) };
    }
  }

  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? body.error : undefined;
    const message = typeof error === "string" ? error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!body || typeof body !== "object") {
    throw new Error("The API returned an invalid response.");
  }

  return body as T;
}

export async function signupManagedUser(email: string, role: ApiRole): Promise<ApiUser> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, role }),
  });

  const data = await parseJson<{ user: ApiUser }>(response);
  return data.user;
}

export async function getManagedUsers(): Promise<ApiUser[]> {
  const response = await fetch("/api/users");
  const data = await parseJson<{ users: ApiUser[] }>(response);
  return data.users;
}

export async function createApiBrief(input: CreateBriefInput): Promise<ApiBrief> {
  const response = await fetch("/api/briefs", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ brief: ApiBrief }>(response);
  return data.brief;
}

export async function getMarketplace(): Promise<ApiMarketplace> {
  const response = await fetch("/api/marketplace");
  return parseJson<ApiMarketplace>(response);
}

export async function createApiBid(briefId: string, input: CreateBidInput): Promise<ApiBid> {
  const response = await fetch(`/api/briefs/${briefId}/bids`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ bid: ApiBid }>(response);
  return data.bid;
}

export async function awardApiBid(
  bidId: string,
  businessId: string,
): Promise<{ agreement: ApiAgreement; escrow: ApiEscrow; txHash: string }> {
  const response = await fetch(`/api/bids/${bidId}/award`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ businessId }),
  });
  return parseJson<{ agreement: ApiAgreement; escrow: ApiEscrow; txHash: string }>(response);
}

export async function bootstrapPocWallets(): Promise<ApiPocWallets> {
  const response = await fetch("/api/poc/wallets", {
    method: "POST",
  });
  const data = await parseJson<{ wallets: ApiPocWallets }>(response);
  return data.wallets;
}

export async function getUsdwToken(): Promise<ApiUsdwToken> {
  const response = await fetch("/api/usdw");
  const data = await parseJson<{ token: ApiUsdwToken }>(response);
  return data.token;
}

export async function getUsdwBalance(userId: string): Promise<ApiUsdwBalance> {
  const response = await fetch(`/api/users/${userId}/usdw-balance`);
  const data = await parseJson<{ balance: ApiUsdwBalance }>(response);
  return data.balance;
}

export async function preparePocTestFunds(): Promise<ApiPocFundingSetup> {
  const response = await fetch("/api/poc/prepare-test-funds", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ ckbAmount: "500", usdwAmount: "1000" }),
  });
  return parseJson<ApiPocFundingSetup>(response);
}

export async function issueUsdw(recipientId: string, amount: string): Promise<string> {
  const response = await fetch("/api/usdw/issue", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ recipientId, amount }),
  });
  const data = await parseJson<{ txHash: string }>(response);
  return data.txHash;
}

export async function fundUsdwEscrow(agreementId: string, businessId: string): Promise<string> {
  const response = await fetch(`/api/agreements/${agreementId}/fund-usdw-escrow`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ businessId }),
  });
  const data = await parseJson<{ txHash: string }>(response);
  return data.txHash;
}

export async function submitApiDelivery(
  agreementId: string,
  input: { creatorId: string; url: string; note: string },
): Promise<ApiDelivery> {
  const response = await fetch(`/api/agreements/${agreementId}/deliveries`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ delivery: ApiDelivery }>(response);
  return data.delivery;
}

export async function releaseUsdwEscrow(agreementId: string, approvedBy: string): Promise<string> {
  const response = await fetch(`/api/agreements/${agreementId}/release-usdw-escrow`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ approvedBy }),
  });
  const data = await parseJson<{ txHash: string }>(response);
  return data.txHash;
}

export async function openApiDispute(
  agreementId: string,
  input: { openedBy: string; reason: string },
): Promise<ApiDispute> {
  const response = await fetch(`/api/agreements/${agreementId}/disputes`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ dispute: ApiDispute }>(response);
  return data.dispute;
}

export async function settleApiDispute(
  disputeId: string,
  input: { adminId: string; decision: "release" | "refund" },
): Promise<{ txHash: string; resolution: "RELEASED" | "REFUNDED" }> {
  const response = await fetch(`/api/disputes/${disputeId}/settle`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return parseJson<{ txHash: string; resolution: "RELEASED" | "REFUNDED" }>(response);
}
