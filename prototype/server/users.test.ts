import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signupUser } from "./users";

describe("managed wallet signup", () => {
  it("creates a public user with a CKB testnet wallet and no exposed private key", async () => {
    const user = await signupUser({
      email: `test-${Date.now()}@example.com`,
      role: "business",
    });

    assert.equal(user.role, "business");
    assert.match(user.wallet.address, /^ckt1/);
    assert.match(user.wallet.publicKey, /^0x/);
    assert.match(user.wallet.lockScript.args, /^0x/);
    assert.equal("encryptedPrivateKey" in user.wallet, false);
  });
});
