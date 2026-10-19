// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TransferRouter.sol";

contract TransferRouterTest is Test {
    TransferRouter public router;

    // Set up dummy addresses for testing destinations
    address payable alice = payable(makeAddr("alice"));
    address payable bob = payable(makeAddr("bob"));

    function setUp() public {
        router = new TransferRouter();
    }

    function test_BatchTransferSuccess() public {
        // Build payload arguments
        address payable[] memory recipients = new address payable[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 2 ether;

        // Execute batch transaction with exactly 3 ETH funding
        router.batchTransferEth{value: 3 ether}(recipients, amounts);

        // Assert balances match exactly on the virtual ledger state
        assertEq(alice.balance, 1 ether);
        assertEq(bob.balance, 2 ether);
    }

    function test_RevertOnLengthMismatch() public {
        address payable[] memory recipients = new address payable[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](1); // Wrong size deliberately
        amounts[0] = 1 ether;

        // Expect the customized gas-optimized panic declaration
        vm.expectRevert(TransferRouter.ArrayLengthMismatch.selector);
        router.batchTransferEth{value: 1 ether}(recipients, amounts);
    }
}
