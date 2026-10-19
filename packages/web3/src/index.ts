import { assert, ethers } from "ethers";
import TransferRouterArtifact from "../../contracts/out/TransferRouter.sol/TransferRouter.json";

// Interface rep the std payload structure
export interface BatchTransferItem {
    recipient: string;
    amountInEth: string;
}

/**
 * Executes a gas-optimized batch ETH routing routine via the TransferRouter smart contract.
 * @param signer The connected Ethers.js Signer (e.g., MetaMask, private key provider).
 * @param contractAddress The deployed address of the TransferRouter contract.
 * @param distributions Array of destination addresses and their respective values.
 */

export async function executeBatchTransfer(
    signer: ethers.Signer,
    contractAddress: string,
    distributions: BatchTransferItem[]
): Promise<ethers.TransactionReceipt | null > {
    // instantiates an active contract wrapper instance using the imported ABI

    const contract = new ethers.Contract(
        contractAddress,
        TransferRouterArtifact.abi,
        signer
    );

    const recipients: string[] = [];
    const amounts: bigint[] = [];
    let totalValue = 0n;

    // translate ui/ts strings to native web3 formats
    for(const item of distributions) {
        recipients.push(item.recipient);
        const weiAmount = ethers.parseEther(item.amountInEth);
        amounts.push(weiAmount);
        totalValue += weiAmount;
    }

    // call external smart contract as message.value
    const tx = await contract.batchTransferEth(recipients, amounts, {
        value: totalValue,
    });

    return tx.wait();
}
