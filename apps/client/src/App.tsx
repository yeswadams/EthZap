import React, { useState } from "react";
import { useWeb3Transfer } from "./hooks/useWeb3Transfer";
import { BatchTransferItem } from "@app/web3";

export default function App() {
  const { status, txHash, errorMessage, runBatchTransfer } = useWeb3Transfer();
  const [contractAddress, setContractAddress] = useState("");

  // Local form input management arrays
  const [recipientsList, setRecipientsList] = useState<BatchTransferItem[]>([
    { recipient: "", amountInEth: "" },
  ]);

  const updateRow = (
    index: number,
    key: keyof BatchTransferItem,
    value: string,
  ) => {
    const updated = [...recipientsList];
    updated[index][key] = value;
    setRecipientsList(updated);
  };

  const addRow = () => {
    setRecipientsList([...recipientsList, { recipient: "", amountInEth: "" }]);
  };

  const removeRow = (index: number) => {
    if (recipientsList.length > 1) {
      setRecipientsList(recipientsList.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAddress)
      return alert("Please specify target TransferRouter address.");
    runBatchTransfer(contractAddress, recipientsList);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Navbar Anchor */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight text-emerald-400">
          EthZap Monorepo
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-slate-400">
            Network State:
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              status === "SUCCESS"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : status === "FAILED"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : status === "MINING"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                    : "bg-slate-800 text-slate-300"
            }`}
          >
            {status}
          </span>
        </div>
      </header>

      {/* Main Board View Container */}
      <main className="max-w-4xl w-full mx-auto p-6 md:p-8 flex-grow">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-2">
            Multi-Wallet Batch Distribution Panel
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Dispatch native assets to multiple destination keys simultaneously
            through an optimized smart contract router wrapper.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Router Contract Mapping Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                TransferRouter Smart Contract Address
              </label>
              <input
                type="text"
                required
                placeholder="0x..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 transition text-mono text-sm"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
              />
            </div>

            {/* Recipient Dynamic Stack Input Forms */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Distribution Recipients Matrix
              </label>
              <div className="space-y-3">
                {recipientsList.map((row, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <input
                      type="text"
                      required
                      placeholder="Destination Address (0x...)"
                      className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-mono focus:outline-none focus:border-emerald-500"
                      value={row.recipient}
                      onChange={(e) =>
                        updateRow(index, "recipient", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Amount (ETH)"
                      className="w-32 md:w-44 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      value={row.amountInEth}
                      onChange={(e) =>
                        updateRow(index, "amountInEth", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      disabled={recipientsList.length === 1}
                      className="p-2 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-500 transition"
                      onClick={() => removeRow(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition"
                onClick={addRow}
              >
                + Append Destination Node
              </button>
            </div>

            {/* Action Trigger Buttons */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={
                  status === "AWAITING_SIGNATURE" || status === "MINING"
                }
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold py-3 rounded-lg transition shadow-md shadow-emerald-500/10"
              >
                {status === "AWAITING_SIGNATURE"
                  ? "Awaiting Wallet Signature..."
                  : status === "MINING"
                    ? "Mining Transaction On-Chain..."
                    : "Execute Batch Distribution"}
              </button>
            </div>
          </form>

          {/* Interactive State Feedback Elements */}
          {errorMessage && (
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">
              <span className="font-semibold">Execution Failure:</span>{" "}
              {errorMessage}
            </div>
          )}

          {txHash && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg text-mono break-all">
              <span className="font-semibold block font-sans text-xs uppercase tracking-wider mb-1">
                Transaction Confirmed Hash:
              </span>
              {txHash}
            </div>
          )}
        </div>
      </main>

      {/* Structured Portfolio Footer */}
      <footer className="border-t border-slate-800 text-center py-4 text-xs text-slate-500 bg-slate-900/20">
        Enterprise Portfolio Monorepo Architecture • Built using pnpm, Nx, and
        Foundry
      </footer>
    </div>
  );
}
