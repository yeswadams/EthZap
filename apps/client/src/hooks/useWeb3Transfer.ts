import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { executeBatchTransfer, BatchTransferItem } from "@app/web3/src/index";

// transaction lifecycle states:
export type TransactionStatus =
  "IDLE" | "AWAITING_SIGNATURE" | "MINING" | "SUCCESS" | "FAILED";

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
        // check for window provider injection: Metamask
        if (!window.ethereum) {
          throw new Error(
            "No crypto wallet extension detected. Please install metamask",
          );
        }

        // instantiate provider & request accounts safely
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // update status and trigger web3 workspace core engine
        setStatus("AWAITING_SIGNATURE");

        const reciept = await executeBatchTransfer(
          signer,
          contractAddress,
          distributions,
        );

        if(reciept) {
          setTxHash(reciept.hash);
          setStatus("SUCCESS");
        } else {
            throw new Error(
              "Transaction executed but returned an unconfirmed receipt.",
            );
        }
      } catch (error: any) {
        console.error("[Hook Transaction Failure]:", error);
        setStatus("FAILED");

        // Map ugly rpc json errors to neat human-readable messages
        if(error.code === "ACTION_REJECTED") {
            setErrorMessage("Transaction signature was rejected by the user.");
        } else {
            setErrorMessage(
              error.message ||
                "An unexpected blockchain execution error occurred.",
            );
        }
      }
    }, []);

    return {
        status,
        txHash,
        errorMessage,
        runBatchTransfer,
    };
}
