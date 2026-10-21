import { useCallback, useState } from "react";
import { ethers } from "ethers";
import { executeBatchTransfer } from "@app/web3/src/index";
import type { BatchTransferItem } from "@app/web3/src/index";

export type TransactionStatus =
  "IDLE" | "AWAITING_SIGNATURE" | "MINING" | "SUCCESS" | "FAILED";

function errorDetails(error: unknown): {
  code: string | undefined;
  message: string;
} {
  if (typeof error !== "object" || error === null) {
    return {
      code: undefined,
      message: "An unexpected blockchain execution error occurred.",
    };
  }
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : undefined;
  const message =
    typeof candidate.shortMessage === "string"
      ? candidate.shortMessage
      : typeof candidate.message === "string"
        ? candidate.message
        : "An unexpected blockchain execution error occurred.";
  return { code, message };
}

export function useWeb3Transfer() {
  const [status, setStatus] = useState<TransactionStatus>("IDLE");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runBatchTransfer = useCallback(
    async (contractAddress: string, distributions: BatchTransferItem[]) => {
      setStatus("IDLE");
      setErrorMessage(null);
      setTxHash(null);

      try {
        if (!window.ethereum) {
          throw new Error(
            "No crypto wallet extension detected. Please install a compatible wallet.",
          );
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setStatus("AWAITING_SIGNATURE");

        const receipt = await executeBatchTransfer(
          signer,
          contractAddress,
          distributions,
          (hash) => {
            setTxHash(hash);
            setStatus("MINING");
          },
        );

        if (!receipt) {
          throw new Error(
            "The transaction was submitted but no receipt was returned.",
          );
        }
        if (receipt.status !== 1) {
          throw new Error(
            "The transaction was included but reverted on-chain.",
          );
        }

        setTxHash(receipt.hash);
        setStatus("SUCCESS");
      } catch (error) {
        const { code, message } = errorDetails(error);
        setStatus("FAILED");
        setErrorMessage(
          code === "ACTION_REJECTED"
            ? "Transaction signature was rejected by the user."
            : message,
        );
      }
    },
    [],
  );

  return { status, txHash, errorMessage, runBatchTransfer };
}
