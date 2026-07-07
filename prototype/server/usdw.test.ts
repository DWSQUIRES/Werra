import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodeUdtAmount, encodeUdtAmount, formatUsdwAmount, parseUsdwAmount } from "./usdw.js";

describe("USDW helpers", () => {
  it("parses and formats USDW amounts with six decimals", () => {
    const units = parseUsdwAmount("123.450001");

    assert.equal(units, 123450001n);
    assert.equal(formatUsdwAmount(units), "123.450001");
    assert.equal(formatUsdwAmount(parseUsdwAmount("10.000000")), "10");
  });

  it("encodes UDT amount data as uint128 little-endian", () => {
    const data = encodeUdtAmount(123450001n);

    assert.equal(data, "0x91b25b07000000000000000000000000");
    assert.equal(decodeUdtAmount(data), 123450001n);
  });
});
