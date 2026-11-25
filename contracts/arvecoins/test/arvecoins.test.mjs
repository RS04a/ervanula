import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createTVM } from "@tvmjs/tvm";
import { createAddressFromString, hexToBytes } from "@tvmjs/util";
import { Interface } from "ethers";

const owner = "0x1000000000000000000000000000000000000001";
const recipient = "0x1000000000000000000000000000000000000002";
const spender = "0x1000000000000000000000000000000000000003";
const supply = 1_000_000_000_000n;
const artifact = JSON.parse(await readFile(new URL("../build/contracts/ArveCoins.json", import.meta.url), "utf8"));
const abi = new Interface(artifact.abi);

async function deploy() {
  const tvm = await createTVM();
  const creation = await tvm.runCall({
    caller: createAddressFromString(owner),
    data: hexToBytes(artifact.bytecode),
    gasLimit: 10_000_000n,
    rootTransactionId: new Uint8Array(32).fill(1),
  });
  assert.equal(creation.execResult.exceptionError, undefined);
  assert.ok(creation.createdAddress);
  assert.ok(creation.execResult.returnValue.length > 0);
  const execute = async (name, args, sender) =>
    (await tvm.runCall({
      caller: createAddressFromString(sender),
      to: creation.createdAddress,
      data: hexToBytes(abi.encodeFunctionData(name, args)),
      gasLimit: 1_000_000n,
    })).execResult;
  return {
    async call(name, args = [], sender = owner) {
      const result = await execute(name, args, sender);
      assert.equal(result.exceptionError, undefined);
      return abi.decodeFunctionResult(name, result.returnValue)[0];
    },
    async expectRevert(name, args, sender, errorName) {
      const result = await execute(name, args, sender);
      assert.equal(result.exceptionError?.error, "revert");
      assert.equal(abi.parseError(result.returnValue)?.name, errorName);
    },
  };
}

test("metadata, supply, and initial distribution", async () => {
  const { call } = await deploy();
  assert.equal(await call("name"), "ArveCoins");
  assert.equal(await call("symbol"), "ARVE");
  assert.equal(await call("decimals"), 6n);
  assert.equal(await call("totalSupply"), supply);
  assert.equal(await call("balanceOf", [owner]), supply);
  assert.equal(await call("balanceOf", [recipient]), 0n);
});

test("transfer conserves supply and changes both balances", async () => {
  const { call } = await deploy();
  assert.equal(await call("transfer", [recipient, 3_250_000n]), true);
  assert.equal(await call("balanceOf", [recipient]), 3_250_000n);
  assert.equal(await call("balanceOf", [owner]), supply - 3_250_000n);
  assert.equal(await call("totalSupply"), supply);
});

test("approve and transferFrom consume the allowance", async () => {
  const { call } = await deploy();
  assert.equal(await call("approve", [spender, 5_000_000n]), true);
  assert.equal(await call("allowance", [owner, spender]), 5_000_000n);
  assert.equal(await call("transferFrom", [owner, recipient, 3_000_000n], spender), true);
  assert.equal(await call("allowance", [owner, spender]), 2_000_000n);
  assert.equal(await call("balanceOf", [recipient]), 3_000_000n);
  assert.equal(await call("balanceOf", [owner]), supply - 3_000_000n);
});

test("insufficient balance or allowance reverts without changing state", async () => {
  const { call, expectRevert } = await deploy();
  await call("approve", [spender, supply + 1n]);
  await expectRevert("transferFrom", [owner, recipient, supply + 1n], spender, "TRC20InsufficientBalance");
  assert.equal(await call("allowance", [owner, spender]), supply + 1n);
  await expectRevert("transferFrom", [owner, recipient, 1n], recipient, "TRC20InsufficientAllowance");
  await expectRevert("transfer", [recipient, supply + 1n], owner, "TRC20InsufficientBalance");
  assert.equal(await call("balanceOf", [owner]), supply);
  assert.equal(await call("balanceOf", [recipient]), 0n);
  assert.equal(await call("totalSupply"), supply);
});

test("the external surface contains only standard TRC-20 functions", () => {
  const functions = artifact.abi.filter((entry) => entry.type === "function").map((entry) => entry.name).sort();
  assert.deepEqual(functions, ["allowance", "approve", "balanceOf", "decimals", "name", "symbol", "totalSupply", "transfer", "transferFrom"]);
});
