import crypto from "node:crypto";
import { z } from "zod";

import { createManagedWallet, toPublicWallet } from "./ckb";
import { updateStore } from "./store";
import type { PublicUser, User, UserRole } from "./types";

export const signupSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.enum(["business", "creator", "admin"]),
});

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    wallet: toPublicWallet(user.wallet),
  };
}

export async function signupUser(input: { email: string; role: UserRole }) {
  const now = new Date().toISOString();
  const wallet = await createManagedWallet();
  let createdOrExisting: User | undefined;

  await updateStore((data) => {
    const existing = data.users.find((user) => user.email === input.email);

    if (existing) {
      createdOrExisting = existing;
      return data;
    }

    const user: User = {
      id: `usr_${crypto.randomUUID()}`,
      email: input.email,
      role: input.role,
      wallet,
      createdAt: now,
    };

    createdOrExisting = user;
    return {
      ...data,
      users: [...data.users, user],
    };
  });

  if (!createdOrExisting) {
    throw new Error("Unable to create user");
  }

  return toPublicUser(createdOrExisting);
}
