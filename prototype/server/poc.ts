import type { StoreData, User } from "./types";
import { signupUser, toPublicUser } from "./users";

export const pocAccounts = {
  business: {
    email: "demo-sme@werra.local",
    role: "business",
    label: "Demo SME",
  },
  creator: {
    email: "demo-creator@werra.local",
    role: "creator",
    label: "Demo Creator",
  },
  issuer: {
    email: "demo-issuer@werra.local",
    role: "admin",
    label: "USDW issuer",
  },
  escrow: {
    email: "demo-escrow@werra.local",
    role: "admin",
    label: "Werra escrow custody",
  },
} as const;

export type PocAccountKey = keyof typeof pocAccounts;

export async function ensurePocWallets() {
  const entries = await Promise.all(
    Object.entries(pocAccounts).map(async ([key, account]) => ({
      key,
      label: account.label,
      user: await signupUser({
        email: account.email,
        role: account.role,
      }),
    })),
  );

  return Object.fromEntries(entries.map(({ key, label, user }) => [key, { label, user }]));
}

export function findPocUser(data: StoreData, key: PocAccountKey) {
  return data.users.find((user) => user.email === pocAccounts[key].email);
}

export function requirePocUser(data: StoreData, key: PocAccountKey): User {
  const user = findPocUser(data, key);

  if (!user) {
    throw new Error(`Missing ${pocAccounts[key].label} wallet. Run POST /api/poc/wallets first.`);
  }

  return user;
}

export function listExistingPocWallets(data: StoreData) {
  return Object.fromEntries(
    Object.entries(pocAccounts).map(([key, account]) => {
      const user = data.users.find((item) => item.email === account.email);
      return [key, user ? { label: account.label, user: toPublicUser(user) } : null];
    }),
  );
}
