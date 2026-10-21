// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TransferRouter.sol";

contract DeployTransferRouter is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    function run() external returns (TransferRouter router) {
        require(block.chainid == SEPOLIA_CHAIN_ID, "Sepolia only");

        vm.startBroadcast();
        router = new TransferRouter();
        vm.stopBroadcast();
    }
}
