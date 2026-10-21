import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  FileCode2,
  History,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Network,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BatchTransferItem } from "@app/web3/src/index";
import { useWeb3Transfer } from "./hooks/useWeb3Transfer";

const DEFAULT_CONTRACT_ADDRESS = "0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092";
const SEPOLIA_CHAIN_ID = 11155111n;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const WEI_PER_ETH = 10n ** 18n;
const NAVIGATION: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "batch", label: "Batch Transfer", icon: Zap },
  { id: "history", label: "Transaction History", icon: History },
  { id: "contract", label: "Contract Details", icon: FileCode2 },
  { id: "settings", label: "Settings", icon: Settings },
];

type PageId = "overview" | "batch" | "history" | "contract" | "settings";
type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
type ActivityItem = {
  id: number;
  at: string;
  level: LogLevel;
  message: string;
};
type ContractCode = "idle" | "checking" | "present" | "missing" | "error";
type TransactionRecord = {
  hash: string;
  contractAddress: string;
  recipients: number;
  totalWei: string;
  timestamp: string;
};
type WalletProvider = {
  request(args: {
    method: string;
    params?: readonly unknown[];
  }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

function getPage(): PageId {
  const candidate = window.location.hash.slice(1);
  return NAVIGATION.some((item) => item.id === candidate)
    ? (candidate as PageId)
    : "overview";
}

function parseEthToWei(value: string): bigint | null {
  const amount = value.trim();
  if (!/^\d+(?:\.\d*)?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > 18) return null;
  return (
    BigInt(whole) * WEI_PER_ETH +
    BigInt((fraction + "0".repeat(18)).slice(0, 18))
  );
}

function formatWei(wei: bigint, precision = 6): string {
  const whole = wei / WEI_PER_ETH;
  const fraction = (wei % WEI_PER_ETH)
    .toString()
    .padStart(18, "0")
    .slice(0, precision)
    .replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ".00"}`;
}

function short(value: string, head = 8, tail = 6): string {
  return value.length > head + tail + 1
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value;
}

function messageOf(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "The wallet request could not be completed.";
}

function readTransactions(): TransactionRecord[] {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem("ethzap-session-transactions") ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TransactionRecord =>
        typeof item === "object" &&
        item !== null &&
        "hash" in item &&
        typeof item.hash === "string" &&
        "contractAddress" in item &&
        typeof item.contractAddress === "string" &&
        "recipients" in item &&
        typeof item.recipients === "number" &&
        "totalWei" in item &&
        typeof item.totalWei === "string" &&
        /^\d+$/.test(item.totalWei) &&
        "timestamp" in item &&
        typeof item.timestamp === "string",
    );
  } catch {
    return [];
  }
}

function App() {
  const { status, txHash, errorMessage, runBatchTransfer } = useWeb3Transfer();
  const [page, setPage] = useState<PageId>(getPage);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contractAddress, setContractAddress] = useState(
    DEFAULT_CONTRACT_ADDRESS,
  );
  const [recipients, setRecipients] = useState<BatchTransferItem[]>([
    { recipient: "", amountInEth: "" },
  ]);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [codeState, setCodeState] = useState<ContractCode>("idle");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [transactions, setTransactions] =
    useState<TransactionRecord[]>(readTransactions);
  const [filter, setFilter] = useState("");
  const [displayPrecision, setDisplayPrecision] = useState(() => {
    try {
      return localStorage.getItem("ethzap-display-precision") === "4" ? 4 : 6;
    } catch {
      return 6;
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const recordedHash = useRef<string | null>(null);

  const log = useCallback((level: LogLevel, message: string) => {
    setActivity((items) =>
      [
        ...items,
        {
          id: Date.now() + Math.random(),
          at: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          level,
          message,
        },
      ].slice(-12),
    );
  }, []);
  const walletProvider = (): WalletProvider | null =>
    window.ethereum ? (window.ethereum as unknown as WalletProvider) : null;

  const refreshWallet = useCallback(async () => {
    const provider = walletProvider();
    if (!provider) {
      setAccount(null);
      setChainId(null);
      return;
    }
    try {
      const [accountsResult, chainResult] = await Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
      ]);
      const accounts = Array.isArray(accountsResult)
        ? accountsResult.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      setAccount(accounts[0] ?? null);
      setChainId(typeof chainResult === "string" ? BigInt(chainResult) : null);
      setWalletMessage(null);
    } catch (error) {
      setWalletMessage(messageOf(error));
    }
  }, []);

  useEffect(() => {
    const updatePage = () => {
      setPage(getPage());
      setMobileNavOpen(false);
    };
    window.addEventListener("hashchange", updatePage);
    if (!window.location.hash)
      window.history.replaceState(null, "", "#overview");
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    void refreshWallet();
    const provider = walletProvider();
    if (!provider?.on) return;
    const onAccounts = (value: unknown) => {
      const accounts = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      setAccount(accounts[0] ?? null);
      setWalletMessage(null);
      log(
        "INFO",
        accounts[0] ? "Wallet account changed." : "Wallet disconnected.",
      );
    };
    const onChain = (value: unknown) => {
      if (typeof value !== "string") return;
      try {
        const nextChain = BigInt(value);
        setChainId(nextChain);
        log("INFO", `Wallet network changed to chain ${nextChain}.`);
      } catch {
        setChainId(null);
      }
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [log, refreshWallet]);

  const correctNetwork = chainId === SEPOLIA_CHAIN_ID;
  const validContractAddress = ADDRESS_PATTERN.test(contractAddress.trim());

  useEffect(() => {
    const provider = walletProvider();
    if (!provider || !correctNetwork || !validContractAddress) {
      setCodeState("idle");
      return;
    }
    let active = true;
    setCodeState("checking");
    void provider
      .request({
        method: "eth_getCode",
        params: [contractAddress.trim(), "latest"],
      })
      .then((result) => {
        if (!active) return;
        if (typeof result !== "string" || !/^0x[\da-fA-F]*$/.test(result))
          setCodeState("error");
        else setCodeState(result.length > 2 ? "present" : "missing");
      })
      .catch(() => {
        if (active) setCodeState("error");
      });
    return () => {
      active = false;
    };
  }, [contractAddress, correctNetwork, validContractAddress]);

  useEffect(() => {
    if (status === "AWAITING_SIGNATURE")
      log("INFO", "Wallet signature requested for batch transfer.");
    if (status === "MINING")
      log("INFO", "Transaction submitted; awaiting confirmation.");
    if (status === "SUCCESS")
      log("SUCCESS", "Batch transfer confirmed on-chain.");
    if (status === "FAILED" && errorMessage) {
      const rejected = /user rejected|action_rejected|user denied/i.test(
        errorMessage,
      );
      log(
        rejected ? "WARNING" : "ERROR",
        rejected
          ? "Wallet signature was rejected; no transfer was confirmed."
          : `Transfer failed: ${errorMessage}`,
      );
    }
  }, [errorMessage, log, status]);

  const rowValidity = useMemo(
    () =>
      recipients.map((row) => {
        const addressValid = ADDRESS_PATTERN.test(row.recipient.trim());
        const wei = parseEthToWei(row.amountInEth);
        return {
          addressValid,
          wei,
          valid: addressValid && wei !== null && wei > 0n,
        };
      }),
    [recipients],
  );
  const validCount = rowValidity.filter((item) => item.valid).length;
  const invalidCount = recipients.length - validCount;
  const totalWei = rowValidity.reduce(
    (sum, item) => sum + (item.wei ?? 0n),
    0n,
  );
  const busy =
    submitting || status === "AWAITING_SIGNATURE" || status === "MINING";
  const walletConnected = Boolean(account);
  const codeMissing = codeState === "missing";
  const canSubmit =
    validContractAddress &&
    correctNetwork &&
    walletConnected &&
    !codeMissing &&
    recipients.length > 0 &&
    validCount === recipients.length &&
    !busy;

  const connectWallet = async () => {
    const provider = walletProvider();
    if (!provider) {
      setWalletMessage("No injected EIP-1193 wallet detected.");
      log("ERROR", "No compatible browser wallet was found.");
      return;
    }
    try {
      const result = await provider.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(result)
        ? result.filter((item): item is string => typeof item === "string")
        : [];
      if (!accounts[0])
        throw new Error("The wallet returned no authorized account.");
      await refreshWallet();
      log("SUCCESS", `Wallet connected: ${short(accounts[0])}.`);
    } catch (error) {
      const message = messageOf(error);
      setWalletMessage(message);
      log(
        "WARNING",
        /reject|denied/i.test(message)
          ? "Wallet connection was rejected."
          : `Wallet connection failed: ${message}`,
      );
    }
  };

  const submitBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current || busy) return;
    const provider = walletProvider();
    if (!provider) {
      setWalletMessage("Install or enable a browser wallet before submitting.");
      log("ERROR", "No injected wallet is available.");
      return;
    }
    if (recipients.length === 0 || validCount !== recipients.length) {
      log(
        "ERROR",
        "Resolve all recipient addresses and amounts before submitting.",
      );
      return;
    }

    lock.current = true;
    setSubmitting(true);
    try {
      const [accountsResult, chainResult] = await Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
      ]);
      const accounts = Array.isArray(accountsResult)
        ? accountsResult.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      const currentChain =
        typeof chainResult === "string" ? BigInt(chainResult) : null;
      setAccount(accounts[0] ?? null);
      setChainId(currentChain);
      if (!accounts[0]) {
        setWalletMessage("Connect a wallet account before submitting.");
        log("WARNING", "No authorized wallet account is available.");
        return;
      }
      if (currentChain !== SEPOLIA_CHAIN_ID) {
        log(
          "ERROR",
          "Switch the wallet to Ethereum Sepolia before submitting.",
        );
        return;
      }
      if (!validContractAddress) {
        log("ERROR", "Enter a valid contract address before submitting.");
        return;
      }

      try {
        const bytecode = await provider.request({
          method: "eth_getCode",
          params: [contractAddress.trim(), "latest"],
        });
        if (typeof bytecode !== "string" || !/^0x[\da-fA-F]*$/.test(bytecode)) {
          setCodeState("error");
          log(
            "ERROR",
            "The wallet returned an invalid response for the contract code check.",
          );
          return;
        }
        if (bytecode === "0x") {
          setCodeState("missing");
          log(
            "ERROR",
            "No contract bytecode exists at this address on Sepolia.",
          );
          return;
        }
        setCodeState("present");
      } catch {
        setCodeState("error");
        log(
          "WARNING",
          "Contract bytecode could not be checked; proceeding with the explicitly configured address.",
        );
      }

      const finalChainResult = await provider.request({
        method: "eth_chainId",
      });
      const finalChain =
        typeof finalChainResult === "string" ? BigInt(finalChainResult) : null;
      setChainId(finalChain);
      if (finalChain !== SEPOLIA_CHAIN_ID) {
        log(
          "ERROR",
          "The wallet network changed during preflight. Switch to Sepolia and retry.",
        );
        return;
      }

      log(
        "INFO",
        `Submitting ${recipients.length} transfers totaling ${formatWei(totalWei, displayPrecision)} ETH.`,
      );
      await runBatchTransfer(
        contractAddress.trim(),
        recipients.map((row) => ({
          recipient: row.recipient.trim(),
          amountInEth: row.amountInEth.trim(),
        })),
      );
    } catch (error) {
      const message = messageOf(error);
      setWalletMessage(message);
      log("ERROR", `Submission preflight failed: ${message}`);
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!txHash || recordedHash.current === txHash || status !== "SUCCESS")
      return;
    recordedHash.current = txHash;
    const record: TransactionRecord = {
      hash: txHash,
      contractAddress: contractAddress.trim(),
      recipients: recipients.length,
      totalWei: totalWei.toString(),
      timestamp: new Date().toISOString(),
    };
    setTransactions((current) => {
      const next = [
        record,
        ...current.filter((item) => item.hash !== txHash),
      ].slice(0, 50);
      try {
        sessionStorage.setItem(
          "ethzap-session-transactions",
          JSON.stringify(next),
        );
      } catch {
        /* Session storage is optional. */
      }
      return next;
    });
    log("SUCCESS", `Confirmed transaction ${short(txHash, 10, 8)}.`);
  }, [contractAddress, log, recipients.length, status, totalWei, txHash]);

  const addRecipient = () => {
    setRecipients((current) => [
      ...current,
      { recipient: "", amountInEth: "" },
    ]);
    log("INFO", "Recipient row added.");
  };
  const removeRecipient = (index: number) => {
    setRecipients((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );
    log("INFO", `Recipient row ${index + 1} removed.`);
  };
  const updateRecipient = (
    index: number,
    key: keyof BatchTransferItem,
    value: string,
  ) =>
    setRecipients((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress.trim());
      setCopied(true);
      log("SUCCESS", "Contract address copied.");
    } catch {
      log("ERROR", "Clipboard access is unavailable in this browser context.");
    }
    window.setTimeout(() => setCopied(false), 1800);
  };

  const choosePrecision = (value: number) => {
    setDisplayPrecision(value);
    try {
      localStorage.setItem("ethzap-display-precision", String(value));
    } catch {
      /* Preference remains active for this page session. */
    }
    log("INFO", `ETH display precision set to ${value} decimals.`);
  };

  const pageHeading: Record<PageId, { title: string; description: string }> = {
    overview: {
      title: "Overview",
      description: "Network, contract readiness, and recent transfer activity.",
    },
    batch: {
      title: "Batch Transfer",
      description:
        "Prepare, review, and submit a multi-recipient native ETH distribution.",
    },
    history: {
      title: "Transaction History",
      description: "Confirmed transfers recorded during this browser session.",
    },
    contract: {
      title: "Contract Details",
      description:
        "Configured Sepolia destination and available on-chain checks.",
    },
    settings: {
      title: "Settings",
      description: "Personalize how amounts are presented in this console.",
    },
  };
  const statusText =
    status === "SUCCESS"
      ? "Confirmed"
      : status === "FAILED"
        ? "Failed"
        : status === "MINING"
          ? "Pending"
          : status === "AWAITING_SIGNATURE"
            ? "Awaiting wallet"
            : "Ready";
  const statusStyle =
    status === "SUCCESS"
      ? "bg-emerald-50 text-emerald-800"
      : status === "FAILED"
        ? "bg-rose-50 text-rose-700"
        : busy
          ? "bg-amber-50 text-amber-800"
          : "bg-slate-100 text-slate-600";
  const codeText =
    codeState === "checking"
      ? "Checking bytecode"
      : codeState === "present"
        ? "Bytecode detected"
        : codeState === "missing"
          ? "No code found"
          : codeState === "error"
            ? "Could not verify"
            : "Not checked";

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-950">
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-[248px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <a
            href="#overview"
            className="flex h-[70px] items-center gap-3 border-b border-slate-100 px-6"
            aria-label="EthZap overview"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <Zap size={18} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-slate-950">
              EthZap
            </span>
          </a>
          <div className="px-4 pt-6">
            <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-400">
              Workspace
            </p>
            <nav aria-label="Main navigation" className="space-y-1">
              {NAVIGATION.map(({ id, label, icon: ItemIcon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={page === id ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${page === id ? "bg-emerald-50 text-emerald-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                >
                  <ItemIcon size={16} strokeWidth={1.8} />
                  <span className="flex-1">{label}</span>
                  {page === id && (
                    <span className="h-4 w-[2px] rounded-full bg-emerald-700" />
                  )}
                </a>
              ))}
            </nav>
          </div>
          <div className="mt-auto border-t border-slate-100 p-4">
            <NetworkPanel correctNetwork={correctNetwork} chainId={chainId} />
            <WalletPanel
              account={account}
              connectWallet={() => void connectWallet()}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-[64px] items-center justify-between px-4 sm:px-7 lg:px-9">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Open navigation"
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen(true)}
                  className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 lg:hidden"
                >
                  <Menu size={19} />
                </button>
                <div className="lg:hidden flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-800 text-white">
                    <Zap size={15} />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    EthZap
                  </span>
                </div>
                <div className="hidden items-center gap-1.5 text-[10px] text-slate-400 sm:flex">
                  <span>Operations</span>
                  <ChevronRight size={12} />
                  <span className="font-medium text-slate-700">
                    {pageHeading[page].title}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`hidden rounded-full px-2.5 py-1.5 font-mono text-[9px] font-medium sm:inline-flex ${correctNetwork ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                >
                  {chainId === null
                    ? "WALLET OFFLINE"
                    : correctNetwork
                      ? "SEPOLIA · 11155111"
                      : `CHAIN ${chainId}`}
                </span>
                {account ? (
                  <button
                    type="button"
                    onClick={() => void refreshWallet()}
                    title="Refresh wallet state"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    <span className="font-mono">{short(account, 6, 4)}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connectWallet()}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-[10px] font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <Wallet size={14} /> Connect wallet
                  </button>
                )}
              </div>
            </div>
          </header>

          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                aria-label="Close navigation overlay"
                onClick={() => setMobileNavOpen(false)}
                className="absolute inset-0 bg-slate-950/30"
              />
              <section
                id="mobile-navigation"
                className="absolute inset-y-0 left-0 flex w-[min(84vw,310px)] flex-col bg-white shadow-xl"
              >
                <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
                  <a
                    href="#overview"
                    onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-2.5 font-semibold text-slate-950"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800 text-white">
                      <Zap size={17} />
                    </span>
                    EthZap
                  </a>
                  <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>
                <nav aria-label="Mobile navigation" className="space-y-1 p-4">
                  {NAVIGATION.map(({ id, label, icon: ItemIcon }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      aria-current={page === id ? "page" : undefined}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[12px] font-medium ${page === id ? "bg-emerald-50 text-emerald-900" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <ItemIcon size={17} />
                      {label}
                    </a>
                  ))}
                </nav>
                <div className="mt-auto space-y-3 border-t border-slate-100 p-4">
                  <NetworkPanel
                    correctNetwork={correctNetwork}
                    chainId={chainId}
                  />
                  <WalletPanel
                    account={account}
                    connectWallet={() => void connectWallet()}
                  />
                </div>
              </section>
            </div>
          )}

          <main className="mx-auto max-w-[1420px] px-4 pb-12 pt-7 sm:px-7 sm:pt-9 lg:px-9">
            <PageHeader
              title={pageHeading[page].title}
              description={pageHeading[page].description}
            />
            {page === "batch" && (
              <BatchPage
                contractAddress={contractAddress}
                setContractAddress={setContractAddress}
                addressValid={validContractAddress}
                codeState={codeState}
                codeText={codeText}
                correctNetwork={correctNetwork}
                account={account}
                walletMessage={walletMessage}
                recipients={recipients}
                rowValidity={rowValidity}
                validCount={validCount}
                invalidCount={invalidCount}
                totalWei={totalWei}
                precision={displayPrecision}
                status={status}
                statusText={statusText}
                statusStyle={statusStyle}
                busy={busy}
                canSubmit={canSubmit}
                txHash={txHash}
                errorMessage={errorMessage}
                copied={copied}
                copyContract={() => void copyContract()}
                addRecipient={addRecipient}
                removeRecipient={removeRecipient}
                updateRecipient={updateRecipient}
                submitBatch={submitBatch}
              />
            )}
            {page === "overview" && (
              <OverviewPage
                correctNetwork={correctNetwork}
                chainId={chainId}
                account={account}
                codeState={codeState}
                contractAddress={contractAddress}
                recipients={recipients}
                validCount={validCount}
                invalidCount={invalidCount}
                totalWei={totalWei}
                precision={displayPrecision}
                status={status}
                transactions={transactions}
                activity={activity}
              />
            )}
            {page === "history" && (
              <HistoryPage
                transactions={transactions}
                filter={filter}
                setFilter={setFilter}
              />
            )}
            {page === "contract" && (
              <ContractPage
                contractAddress={contractAddress}
                setContractAddress={setContractAddress}
                codeState={codeState}
                codeText={codeText}
                correctNetwork={correctNetwork}
                copyContract={() => void copyContract()}
                copied={copied}
              />
            )}
            {page === "settings" && (
              <SettingsPage
                precision={displayPrecision}
                onPrecisionChange={choosePrecision}
              />
            )}
          </main>

          <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-[1420px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[9px] text-slate-500 sm:px-7 lg:px-9">
              <span>
                <strong className="font-semibold text-slate-700">EthZap</strong>{" "}
                <span className="mx-1 text-slate-300">·</span>Ethereum
                operations console
              </span>
              <span className="font-mono uppercase tracking-wide">
                pnpm <i className="mx-1 not-italic text-slate-300">·</i> Nx{" "}
                <i className="mx-1 not-italic text-slate-300">·</i> Foundry
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-800">
          Ethereum operations{" "}
          <ChevronRight size={12} className="text-slate-400" /> Sepolia
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-.045em] text-slate-950">
          {title}
        </h1>
        <p className="mt-1.5 text-[12px] text-slate-500">{description}</p>
      </div>
      <span className="flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[9px] text-slate-500 ring-1 ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        Session-local data
      </span>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  icon: IconComponent,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          {IconComponent && (
            <IconComponent size={16} className="text-slate-400" />
          )}
          <div>
            {eyebrow && (
              <p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-400">
                {eyebrow}
              </p>
            )}
            <h2
              className={`${eyebrow ? "mt-1" : ""} text-[13px] font-semibold text-slate-900`}
            >
              {title}
            </h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  const valueColor =
    tone === "good"
      ? "text-emerald-800"
      : tone === "bad"
        ? "text-rose-700"
        : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p
        className={`mt-1.5 truncate font-mono text-[20px] font-medium tabular-nums ${valueColor}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[9px] text-slate-400">{hint}</p>}
    </div>
  );
}

function NetworkPanel({
  correctNetwork,
  chainId,
}: {
  correctNetwork: boolean;
  chainId: bigint | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-700">
        <Network
          size={14}
          className={correctNetwork ? "text-emerald-700" : "text-amber-600"}
        />
        {correctNetwork
          ? "Ethereum Sepolia"
          : chainId === null
            ? "Wallet not connected"
            : `Unsupported chain ${chainId}`}
      </div>
      <p className="mt-1 pl-[22px] font-mono text-[9px] text-slate-400">
        {correctNetwork
          ? "Chain ID 11155111"
          : "Sepolia is required for transfers"}
      </p>
    </div>
  );
}

function WalletPanel({
  account,
  connectWallet,
}: {
  account: string | null;
  connectWallet: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2.5">
      {account ? (
        <>
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wide text-slate-400">
              Connected wallet
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-700">
              {short(account, 7, 5)}
            </p>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={connectWallet}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[10px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          <Wallet size={14} />
          Connect wallet
        </button>
      )}
    </div>
  );
}

function BatchPage(props: {
  contractAddress: string;
  setContractAddress: (value: string) => void;
  addressValid: boolean;
  codeState: ContractCode;
  codeText: string;
  correctNetwork: boolean;
  account: string | null;
  walletMessage: string | null;
  recipients: BatchTransferItem[];
  rowValidity: { addressValid: boolean; wei: bigint | null; valid: boolean }[];
  validCount: number;
  invalidCount: number;
  totalWei: bigint;
  precision: number;
  status: string;
  statusText: string;
  statusStyle: string;
  busy: boolean;
  canSubmit: boolean;
  txHash: string | null;
  errorMessage: string | null;
  copied: boolean;
  copyContract: () => void;
  addRecipient: () => void;
  removeRecipient: (index: number) => void;
  updateRecipient: (
    index: number,
    key: keyof BatchTransferItem,
    value: string,
  ) => void;
  submitBatch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const {
    contractAddress,
    setContractAddress,
    addressValid,
    codeState,
    codeText,
    correctNetwork,
    account,
    walletMessage,
    recipients,
    rowValidity,
    validCount,
    invalidCount,
    totalWei,
    precision,
    status,
    statusText,
    statusStyle,
    busy,
    canSubmit,
    txHash,
    errorMessage,
    copied,
    copyContract,
    addRecipient,
    removeRecipient,
    updateRecipient,
    submitBatch,
  } = props;
  return (
    <form
      onSubmit={submitBatch}
      className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.8fr)]"
    >
      <div className="space-y-5">
        <Panel title="Batch Transfer Contract" eyebrow="Destination">
          <div className="p-5">
            <label
              htmlFor="contract-address"
              className="mb-2 block text-[10px] font-medium text-slate-600"
            >
              Contract address
            </label>
            <div
              className={`flex items-center rounded-lg border focus-within:ring-2 focus-within:ring-emerald-700/10 ${contractAddress && !addressValid ? "border-rose-300" : "border-slate-300 focus-within:border-emerald-700"}`}
            >
              <input
                id="contract-address"
                disabled={busy}
                value={contractAddress}
                onChange={(event) => setContractAddress(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!addressValid}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[11px] outline-none"
              />
              <button
                type="button"
                onClick={copyContract}
                aria-label="Copy contract address"
                className="rounded p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <Copy size={15} />
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${encodeURIComponent(contractAddress.trim())}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open contract on Sepolia Etherscan"
                className="mr-2 rounded p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <ExternalLink size={15} />
              </a>
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[9px]">
              <span
                className={addressValid ? "text-slate-500" : "text-rose-600"}
              >
                {addressValid
                  ? "Address format valid"
                  : "Enter a valid 20-byte Ethereum address"}
              </span>
              <span
                className={
                  codeState === "present"
                    ? "text-emerald-700"
                    : codeState === "missing"
                      ? "text-rose-700"
                      : "text-slate-500"
                }
              >
                {codeText}
              </span>
            </div>
            {codeState === "error" && (
              <p className="mt-2 text-[9px] text-amber-700">
                Code lookup is unavailable. Submission will still check chain
                and wallet state.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title="Recipients"
          eyebrow="Payout manifest"
          action={
            <button
              type="button"
              disabled={busy}
              onClick={addRecipient}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:border-emerald-700 hover:text-emerald-800 disabled:opacity-40"
            >
              <Plus size={14} />
              Add recipient
            </button>
          }
        >
          {recipients.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[12px] font-medium text-slate-800">
                No recipients yet
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Add an address and ETH amount to prepare a batch.
              </p>
              <button
                type="button"
                onClick={addRecipient}
                className="mt-3 text-[10px] font-semibold text-emerald-800"
              >
                Add first recipient
              </button>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[34px_minmax(0,1fr)_145px_34px] gap-3 bg-slate-50 px-5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
                <span>#</span>
                <span>Destination address</span>
                <span>Amount · ETH</span>
                <span />
              </div>
              <div className="divide-y divide-slate-100">
                {recipients.map((row, index) => {
                  const validation = rowValidity[index];
                  const amountValid =
                    validation.wei !== null && validation.wei > 0n;
                  return (
                    <div
                      key={index}
                      className="grid grid-cols-[24px_minmax(0,1fr)_34px] items-start gap-2 px-4 py-3 sm:grid-cols-[34px_minmax(0,1fr)_145px_34px] sm:items-center sm:gap-3 sm:px-5"
                    >
                      <span className="pt-3 font-mono text-[9px] text-slate-400 sm:pt-0">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="grid min-w-0 gap-2 sm:contents">
                        <div>
                          <label
                            htmlFor={`recipient-${index}`}
                            className="mb-1 block text-[9px] text-slate-500 sm:sr-only"
                          >
                            Recipient Ethereum address
                          </label>
                          <input
                            id={`recipient-${index}`}
                            disabled={busy}
                            value={row.recipient}
                            onChange={(event) =>
                              updateRecipient(
                                index,
                                "recipient",
                                event.target.value,
                              )
                            }
                            spellCheck={false}
                            autoComplete="off"
                            placeholder="0x recipient address"
                            aria-invalid={
                              Boolean(row.recipient) && !validation.addressValid
                            }
                            className={`w-full rounded-md border px-2.5 py-2.5 font-mono text-[10px] outline-none focus:ring-2 focus:ring-emerald-700/10 ${row.recipient && !validation.addressValid ? "border-rose-300" : "border-slate-300 focus:border-emerald-700"}`}
                          />
                          {row.recipient && (
                            <p
                              className={`mt-1 text-[9px] ${validation.addressValid ? "text-slate-400" : "text-rose-600"}`}
                            >
                              {validation.addressValid
                                ? "Address valid"
                                : "Invalid address"}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor={`amount-${index}`}
                            className="mb-1 block text-[9px] text-slate-500 sm:sr-only"
                          >
                            Amount in ETH
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id={`amount-${index}`}
                              disabled={busy}
                              value={row.amountInEth}
                              onChange={(event) =>
                                updateRecipient(
                                  index,
                                  "amountInEth",
                                  event.target.value,
                                )
                              }
                              inputMode="decimal"
                              placeholder="0.00"
                              aria-invalid={
                                Boolean(row.amountInEth) && !amountValid
                              }
                              className={`min-w-0 flex-1 rounded-md border px-2.5 py-2.5 text-right font-mono text-[11px] tabular-nums outline-none focus:ring-2 focus:ring-emerald-700/10 ${row.amountInEth && !amountValid ? "border-rose-300" : "border-slate-300 focus:border-emerald-700"}`}
                            />
                            <span className="text-[9px] text-slate-400 sm:hidden">
                              ETH
                            </span>
                          </div>
                          {row.amountInEth && (
                            <p
                              className={`mt-1 hidden text-[9px] sm:block ${amountValid ? "text-slate-400" : "text-rose-600"}`}
                            >
                              {amountValid
                                ? "Positive · up to 18 decimals"
                                : "Invalid ETH amount"}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        disabled={busy}
                        aria-label={`Remove recipient ${index + 1}`}
                        className="mt-1 rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 sm:mt-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Review before signing" eyebrow="Submission">
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Recipient rows" value={String(recipients.length)} />
              <Stat label="Valid rows" value={String(validCount)} tone="good" />
              <Stat
                label="Invalid rows"
                value={String(invalidCount)}
                tone={invalidCount ? "bad" : "default"}
              />
              <Stat
                label="Total volume"
                value={formatWei(totalWei, precision)}
                hint="ETH"
                tone="good"
              />
            </div>
            <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center">
              <p className="text-[10px] leading-4 text-slate-500">
                Confirm each recipient and amount in your wallet. This action
                transfers native ETH.
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {busy ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    {status === "AWAITING_SIGNATURE"
                      ? "Awaiting wallet approval"
                      : status === "MINING"
                        ? "Transaction pending…"
                        : "Submitting transfer…"}
                  </>
                ) : (
                  <>
                    Submit batch <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
            {!account && (
              <p className="mt-2 text-[10px] text-amber-700">
                Connect a wallet to enable submission.
              </p>
            )}
            {account && !correctNetwork && (
              <p className="mt-2 text-[10px] text-amber-700">
                Switch to Ethereum Sepolia to submit.
              </p>
            )}
            {codeState === "missing" && (
              <p className="mt-2 text-[10px] text-rose-700">
                No contract bytecode was found on Sepolia; submission is
                blocked.
              </p>
            )}
            {walletMessage && (
              <p role="status" className="mt-2 text-[10px] text-rose-700">
                {walletMessage}
              </p>
            )}
            {errorMessage && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[10px] leading-5 text-rose-800"
              >
                {/REJECTED|user denied/i.test(errorMessage)
                  ? "Wallet signature rejected. No successful transfer was confirmed."
                  : errorMessage}
              </div>
            )}
            {txHash && status === "MINING" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <LoaderCircle size={14} className="animate-spin" />
                  Submitted · awaiting confirmation
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono underline underline-offset-2"
                >
                  {short(txHash, 10, 8)} <ExternalLink size={12} />
                </a>
              </div>
            )}
            {txHash && status === "FAILED" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-800">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CircleAlert size={14} />
                  Transaction failed
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono underline underline-offset-2"
                >
                  {short(txHash, 10, 8)} <ExternalLink size={12} />
                </a>
              </div>
            )}
            {txHash && status === "SUCCESS" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[10px] text-emerald-800">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Check size={14} />
                  Confirmed
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono underline underline-offset-2"
                >
                  {short(txHash, 10, 8)} <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <aside className="space-y-5 xl:sticky xl:top-20">
        <Panel title="Batch overview" eyebrow="Live metrics" icon={Activity}>
          <div className="p-5">
            <p className="text-[10px] text-slate-500">Total amount entered</p>
            <p className="mt-1 font-mono text-[29px] font-medium tabular-nums tracking-tight text-slate-950">
              {formatWei(totalWei, precision)}{" "}
              <span className="text-[12px] text-slate-500">ETH</span>
            </p>
            <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-[10px]">
              <ReviewLine label="Rows" value={String(recipients.length)} />
              <ReviewLine
                label="Valid allocations"
                value={String(validCount)}
                tone="good"
              />
              <ReviewLine
                label="Invalid rows"
                value={String(invalidCount)}
                tone={invalidCount ? "bad" : "default"}
              />
              <ReviewLine
                label="Network"
                value={correctNetwork ? "Sepolia" : "Not ready"}
              />
            </div>
          </div>
        </Panel>
        <Panel title="Contract status" eyebrow="Destination" icon={FileCode2}>
          <div className="p-4">
            <p className="break-all font-mono text-[10px] text-slate-700">
              {contractAddress}
            </p>
            <div className="mt-3 flex items-center justify-between text-[9px]">
              <span className="text-slate-500">Bytecode</span>
              <span
                className={
                  codeState === "present"
                    ? "text-emerald-700"
                    : codeState === "missing"
                      ? "text-rose-700"
                      : "text-slate-500"
                }
              >
                {codeText}
              </span>
            </div>
            <a
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 hover:text-emerald-950"
              href={`https://sepolia.etherscan.io/address/${encodeURIComponent(contractAddress.trim())}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan <ExternalLink size={12} />
            </a>
          </div>
        </Panel>
      </aside>
    </form>
  );
}

function ReviewLine({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "default";
}) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`font-mono ${tone === "good" ? "text-emerald-800" : tone === "bad" ? "text-rose-700" : "text-slate-700"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function OverviewPage(props: {
  correctNetwork: boolean;
  chainId: bigint | null;
  account: string | null;
  codeState: ContractCode;
  contractAddress: string;
  recipients: BatchTransferItem[];
  validCount: number;
  invalidCount: number;
  totalWei: bigint;
  precision: number;
  status: string;
  transactions: TransactionRecord[];
  activity: ActivityItem[];
}) {
  const {
    correctNetwork,
    chainId,
    account,
    codeState,
    contractAddress,
    recipients,
    validCount,
    invalidCount,
    totalWei,
    precision,
    status,
    transactions,
    activity,
  } = props;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Wallet"
          value={account ? short(account, 5, 4) : "Not connected"}
          hint={account ? "Injected account" : "Information unavailable"}
          tone={account ? "good" : "default"}
        />
        <Stat
          label="Network"
          value={
            correctNetwork
              ? "Sepolia"
              : chainId === null
                ? "Unavailable"
                : `Chain ${chainId}`
          }
          hint={
            correctNetwork
              ? "Chain ID 11155111"
              : "Sepolia required for transfers"
          }
          tone={correctNetwork ? "good" : "bad"}
        />
        <Stat
          label="Router bytecode"
          value={
            codeState === "present"
              ? "Detected"
              : codeState === "missing"
                ? "Missing"
                : codeState === "checking"
                  ? "Checking"
                  : "Unverified"
          }
          hint="Bytecode is not ABI verification"
          tone={
            codeState === "present"
              ? "good"
              : codeState === "missing"
                ? "bad"
                : "default"
          }
        />
        <Stat
          label="Current batch"
          value={`${validCount} / ${recipients.length}`}
          hint={`${invalidCount} invalid rows · ${formatWei(totalWei, precision)} ETH entered`}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        <Panel
          title="Transfer readiness"
          eyebrow="Current workspace"
          icon={ShieldCheck}
          action={
            <a
              href="#batch"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800"
            >
              Open batch <ArrowRight size={13} />
            </a>
          }
        >
          <div className="divide-y divide-slate-100 px-5">
            <ReviewLine
              label="Wallet connection"
              value={account ? "Connected" : "Disconnected"}
              tone={account ? "good" : "bad"}
            />
            <ReviewLine
              label="Wallet network"
              value={correctNetwork ? "Sepolia" : "Needs attention"}
              tone={correctNetwork ? "good" : "bad"}
            />
            <ReviewLine
              label="Target code check"
              value={
                codeState === "present"
                  ? "Bytecode detected"
                  : codeState === "missing"
                    ? "No code"
                    : codeState === "checking"
                      ? "Checking"
                      : "Unavailable"
              }
              tone={
                codeState === "present"
                  ? "good"
                  : codeState === "missing"
                    ? "bad"
                    : "default"
              }
            />
            <ReviewLine
              label="Last transfer state"
              value={status === "IDLE" ? "No current transfer" : status}
              tone={
                status === "SUCCESS"
                  ? "good"
                  : status === "FAILED"
                    ? "bad"
                    : "default"
              }
            />
          </div>
        </Panel>
        <Panel
          title="Recent confirmed transactions"
          eyebrow="This browser session"
          icon={History}
          action={
            <a
              href="#history"
              className="text-[10px] font-semibold text-emerald-800"
            >
              View history
            </a>
          }
        >
          {transactions.length ? (
            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 4).map((item) => (
                <TransactionRow key={item.hash} item={item} />
              ))}
            </div>
          ) : (
            <Empty
              text="No confirmed transfers in this session."
              hint="Historical indexing is not connected."
            />
          )}
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        <Panel
          title="Configured router"
          eyebrow="Sepolia contract"
          icon={FileCode2}
        >
          <div className="p-5">
            <p className="break-all font-mono text-[11px] text-slate-700">
              {contractAddress}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href="#contract"
                className="text-[10px] font-medium text-emerald-800 hover:underline"
              >
                Contract details
              </a>
              <a
                href={`https://sepolia.etherscan.io/address/${encodeURIComponent(contractAddress)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 hover:underline"
              >
                Etherscan <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </Panel>
        <Panel title="Recent activity" eyebrow="Client session" icon={Activity}>
          {activity.length ? (
            <div className="divide-y divide-slate-100">
              {activity
                .slice(-4)
                .reverse()
                .map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
            </div>
          ) : (
            <Empty
              text="No client events yet."
              hint="Wallet and transfer activity will appear here."
            />
          )}
        </Panel>
      </div>
    </>
  );
}

function TransactionRow({ item }: { item: TransactionRecord }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      <div>
        <a
          href={`https://sepolia.etherscan.io/tx/${encodeURIComponent(item.hash)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-800 hover:underline"
        >
          {short(item.hash, 9, 7)} <ExternalLink size={11} />
        </a>
        <p className="mt-1 text-[9px] text-slate-500">
          {item.recipients} recipients ·{" "}
          {new Date(item.timestamp).toLocaleString()}
        </p>
      </div>
      <span className="font-mono text-[10px] tabular-nums text-slate-700">
        {formatWei(BigInt(item.totalWei))} ETH
      </span>
    </div>
  );
}

function Empty({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <Clock3 size={19} className="mx-auto text-slate-300" />
      <p className="mt-2 text-[11px] font-medium text-slate-700">{text}</p>
      <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const tone =
    item.level === "SUCCESS"
      ? "text-emerald-700"
      : item.level === "ERROR"
        ? "text-rose-700"
        : item.level === "WARNING"
          ? "text-amber-700"
          : "text-slate-400";
  return (
    <div className="flex gap-2 px-5 py-3 text-[9px]">
      <time className="shrink-0 font-mono text-slate-400">{item.at}</time>
      <span className={`shrink-0 font-semibold ${tone}`}>{item.level}</span>
      <span className="min-w-0 break-words text-slate-600">{item.message}</span>
    </div>
  );
}

function HistoryPage({
  transactions,
  filter,
  setFilter,
}: {
  transactions: TransactionRecord[];
  filter: string;
  setFilter: (value: string) => void;
}) {
  const shown = transactions.filter((item) =>
    `${item.hash} ${item.contractAddress}`
      .toLowerCase()
      .includes(filter.toLowerCase().trim()),
  );
  return (
    <Panel
      title="Confirmed transactions"
      eyebrow="Current browser session"
      icon={History}
      action={
        <span className="rounded border border-slate-200 px-2 py-1 font-mono text-[9px] text-slate-500">
          {transactions.length} RECORDS
        </span>
      }
    >
      <div className="border-b border-slate-100 p-4">
        <label htmlFor="history-filter" className="sr-only">
          Filter transactions by hash or contract
        </label>
        <input
          id="history-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by transaction hash or contract address"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[11px] outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
        />
      </div>
      {shown.length ? (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_170px_110px_110px] gap-3 bg-slate-50 px-5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
            <span>Transaction</span>
            <span>Timestamp</span>
            <span>Recipients</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-slate-100">
            {shown.map((item) => (
              <div
                key={item.hash}
                className="grid grid-cols-2 gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_170px_110px_110px] sm:items-center"
              >
                <a
                  href={`https://sepolia.etherscan.io/tx/${encodeURIComponent(item.hash)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-2 inline-flex items-center gap-1.5 truncate font-mono text-[10px] text-emerald-800 hover:underline sm:col-span-1"
                >
                  {item.hash}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
                <span className="text-[9px] text-slate-500 sm:text-[10px]">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
                <span className="text-[9px] text-slate-600 sm:text-[10px]">
                  {item.recipients} recipients
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-slate-800">
                  {formatWei(BigInt(item.totalWei))} ETH
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty
          text={
            filter
              ? "No matching transactions."
              : "No confirmed transactions in this session."
          }
          hint="This app has no historical transaction index. Session records survive refresh in this browser tab only."
        />
      )}
    </Panel>
  );
}

function ContractPage({
  contractAddress,
  setContractAddress,
  codeState,
  codeText,
  correctNetwork,
  copyContract,
  copied,
}: {
  contractAddress: string;
  setContractAddress: (value: string) => void;
  codeState: ContractCode;
  codeText: string;
  correctNetwork: boolean;
  copyContract: () => void;
  copied: boolean;
}) {
  const addressValid = ADDRESS_PATTERN.test(contractAddress.trim());
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
      <Panel
        title="Configured contract"
        eyebrow="Ethereum Sepolia"
        icon={FileCode2}
      >
        <div className="p-5">
          <label
            htmlFor="details-contract"
            className="mb-2 block text-[10px] font-medium text-slate-500"
          >
            Contract address · editable setting
          </label>
          <input
            id="details-contract"
            value={contractAddress}
            onChange={(event) => setContractAddress(event.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 font-mono text-[11px] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyContract}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-[10px] font-medium hover:bg-slate-50"
            >
              <Copy size={13} />
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              href={`https://sepolia.etherscan.io/address/${encodeURIComponent(contractAddress.trim())}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-[10px] font-medium hover:bg-slate-50"
            >
              Open in Etherscan <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </Panel>
      <Panel
        title="Verification status"
        eyebrow="Available checks"
        icon={ShieldCheck}
      >
        <dl className="divide-y divide-slate-100 px-5">
          <ReviewLine
            label="Network"
            value={
              correctNetwork ? "Ethereum Sepolia" : "Not connected to Sepolia"
            }
            tone={correctNetwork ? "good" : "bad"}
          />
          <ReviewLine
            label="Address syntax"
            value={addressValid ? "Valid EVM address" : "Invalid address"}
            tone={addressValid ? "good" : "bad"}
          />
          <ReviewLine
            label="On-chain bytecode"
            value={codeText}
            tone={
              codeState === "present"
                ? "good"
                : codeState === "missing"
                  ? "bad"
                  : "default"
            }
          />
          <div className="py-3 text-[10px] leading-5 text-slate-500">
            Bytecode detection does not verify the source, ABI, ownership, or
            audit status. Source verification details are unavailable in this
            app.
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function SettingsPage({
  precision,
  onPrecisionChange,
}: {
  precision: number;
  onPrecisionChange: (value: number) => void;
}) {
  return (
    <div className="max-w-3xl">
      <Panel
        title="Display preferences"
        eyebrow="Saved in this browser"
        icon={Settings}
      >
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-[11px] font-semibold text-slate-800">
              ETH amount precision
            </h3>
            <p className="mt-1 max-w-lg text-[10px] leading-5 text-slate-500">
              Choose how many fractional digits are shown in totals and
              transaction records. Transfer values continue to use their full
              validated precision.
            </p>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-slate-600">
            Display decimals
            <select
              value={precision}
              onChange={(event) =>
                onPrecisionChange(Number(event.target.value))
              }
              className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[10px] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            >
              <option value={4}>4 decimals</option>
              <option value={6}>6 decimals</option>
            </select>
          </label>
        </div>
      </Panel>
      <div className="mt-4 flex gap-2 rounded-lg border border-slate-200 bg-white p-4 text-[10px] leading-5 text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" />
        Settings are stored in localStorage on this device. Wallet connections
        and transaction records are handled separately by the wallet and current
        browser session.
      </div>
    </div>
  );
}

export default App;
