// Node fork test file
import {describe, it, beforeAll, afterAll, expect } from 'vitest';
import {exec, ChildProcess} from 'child_process';
import {ethers} from 'ethers';
import {transferEth} from './index';

const ANVIL_PORT = 8545;
const LOCAL_RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

describe('Web3 Fork Intergration Tests', () => { 
    let anvilProcess: ChildProcess;
    let provider : ethers.JsonRpcProvider;

    beforeAll(async () => {
        const rpcUrl = process.env.MAINNET_RPC_URL || 'https://llamarpc.com';
        const forkBlock = 20000000;

        anvilProcess = exec(
            `anvil --fork-url ${rpcUrl} --fork-block-number ${forkBlock} --port ${ANVIL_PORT}`
        )

        // 2. Wait for the local RPC node to accept inbound traffic
        provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);

        let attempts = 0;
        while (attempts < 10) {
            try {
                await provider.getBlockNumber();
                break;
            } catch {
                attempts++;
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
    });

    afterAll(() => {
        if(anvilProcess) anvilProcess.kill();
    });

    it('should successfully execute real ETH transfer on the mainnet fork', async  () => {
        const privateKey =
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const signer = new ethers.Wallet(privateKey, provider);

        const recipient = ethers.Wallet.createRandom().address;
        const transferAmount = '1.5'; // 1.5 ETH

        const intialBalance = await provider.getBalance(recipient);
        expect(intialBalance).toBe(0n);

        await transferEth(signer, recipient, transferAmount);

        const finalBalance = await provider.getBalance(recipient);
        expect(finalBalance).toBe(ethers.parseEther(transferAmount));
    })


 })