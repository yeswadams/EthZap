// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TransferRouter
 * @author Adams Yeswa
 * @notice Efficiently routes native ETH to multiple destination addresses in a single transaction.
 */
contract TransferRouter {
    // --- Events ---
    event EthTransferred(address indexed recipient, uint256 amount);
    event BatchCompleted(uint256 totalRecipients, uint256 totalAmount);

    // --- Custom Errors (Gas Optimized) ---
    error ArrayLengthMismatch();
    error TransferFailed(address recipient);
    error InsufficientValueSent();

    /**
     * @notice Dispatches ETH to an array of recipients based on an array of amounts.
     * @dev Uses custom errors and a caching loop to optimize gas consumption.
     * @param recipients Array of destination wallet addresses.
     * @param amounts Array of specific ETH values to send (denominated in wei).
     */
    function batchTransferEth(address payable[] calldata recipients, uint256[] calldata amounts) external payable {
        uint256 length = recipients.length;
        if (length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalRequired = 0;

        // Loop and transfer to each address
        for (uint256 i = 0; i < length; ++i) {
            address payable recipient = recipients[i];
            uint256 amount = amounts[i];

            totalRequired += amount;

            // Low-level call to safely transfer ETH
            (bool success,) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed(recipient);

            emit EthTransferred(recipient, amount);
        }

        // Strict validation: Ensure the sender sent exactly enough ETH to cover the operation
        if (msg.value < totalRequired) revert InsufficientValueSent();

        emit BatchCompleted(length, totalRequired);

        // Refund excess ETH back to the sender if they overpaid gas/value requirements
        if (msg.value > totalRequired) {
            uint256 excess = msg.value - totalRequired;
            (bool refundSuccess,) = payable(msg.sender).call{value: excess}("");
            if (!refundSuccess) revert TransferFailed(msg.sender);
        }
    }

    /**
     * @notice Fallback function to allow the contract to receive native ETH smoothly.
     */
    receive() external payable {}
}
