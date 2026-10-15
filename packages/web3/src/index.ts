import {ethers} from "ethers";
import TransferRouteABI from "../../smart-contracts/out/TransferRoute.sol/TransferRouter.json";

export function getContractInstance(address: string, provider: ethers.provider | ethers.signer) {
    return new ethers.Contract(address, TransferRouteABI.abi, providerOrSigner);
}