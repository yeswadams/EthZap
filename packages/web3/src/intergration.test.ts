import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { ethers } from "ethers";
import { executeBatchTransfer, type BatchTransferItem } from "./index";
import TransferRouterArtifact from "../../contracts/out/TransferRouter.sol/TransferRouter.json";

const ANVIL_PORT = 18545;
const LOCAL_RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const CHAIN_ID = 31337;
const STARTUP_TIMEOUT_MS = 30_000;

describe("Web3 Contract Integration Tests", () => {
  let anvilProcess: ChildProcess | undefined;
  let provider: ethers.JsonRpcProvider | undefined;
  let deployerWallet: ethers.NonceManager;
  let contractAddress: string;

  beforeAll(async () => {
    anvilProcess = spawn(
      "anvil",
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(ANVIL_PORT),
        "--chain-id",
        String(CHAIN_ID),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let anvilOutput = "";

    anvilProcess.stdout?.on("data", (chunk: Buffer) => {
      anvilOutput += chunk.toString();
    });

    anvilProcess.stderr?.on("data", (chunk: Buffer) => {
      anvilOutput += chunk.toString();
    });

    anvilProcess.on("error", (error) => {
      anvilOutput += `\nAnvil process error: ${error.message}`;
    });

    const child = anvilProcess;

    provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL, CHAIN_ID, {
      staticNetwork: true,
      // Read the latest mined state immediately after a transaction receipt.
      cacheTimeout: -1,
    });

    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let lastError: unknown;
    let ready = false;

    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Anvil exited before becoming ready.\n${anvilOutput}`);
      }

      try {
        const chainId = await provider.send("eth_chainId", []);

        if (BigInt(chainId) !== BigInt(CHAIN_ID)) {
          throw new Error(`Unexpected Anvil chain ID: ${chainId}`);
        }

        await provider.getBlockNumber();
        ready = true;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!ready) {
      throw new Error(
        `Anvil did not become ready within ${STARTUP_TIMEOUT_MS}ms.\n` +
          `Last RPC error: ${String(lastError)}\n` +
          `Anvil output:\n${anvilOutput}`,
      );
    }

    const defaultAnvilPrivateKey =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    // Keep a single nonce sequence across deployment and subsequent test calls.
    // JsonRpcProvider's pending nonce can briefly lag behind a just-mined tx.
    deployerWallet = new ethers.NonceManager(
      new ethers.Wallet(defaultAnvilPrivateKey, provider),
    );

    const factory = new ethers.ContractFactory(
      TransferRouterArtifact.abi,
      TransferRouterArtifact.bytecode.object,
      deployerWallet,
    );

    const contract = await factory.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  }, 45_000);

  afterAll(async () => {
    provider?.destroy();

    const child = anvilProcess;

    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          child.kill("SIGKILL");
        }, 3_000);

        child.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });

        child.kill("SIGTERM");
      });
    }
  });

  it("should deploy the contract and process multi-wallet batch distributions on-chain", async () => {
    if (!provider) {
      throw new Error("Provider was not initialized.");
    }

    const aliceAddress = ethers.Wallet.createRandom().address;
    const bobAddress = ethers.Wallet.createRandom().address;

    const payload: BatchTransferItem[] = [
      { recipient: aliceAddress, amountInEth: "2.5" },
      { recipient: bobAddress, amountInEth: "1.25" },
    ];

    expect(await provider.getBalance(aliceAddress)).toBe(0n);
    expect(await provider.getBalance(bobAddress)).toBe(0n);

    const receipt = await executeBatchTransfer(
      deployerWallet,
      contractAddress,
      payload,
    );

    expect(receipt).not.toBeNull();
    expect(receipt!.status).toBe(1);

    expect(await provider.getBalance(aliceAddress)).toBe(
      ethers.parseEther("2.5"),
    );

    expect(await provider.getBalance(bobAddress)).toBe(
      ethers.parseEther("1.25"),
    );
  });
});
