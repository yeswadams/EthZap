# EthZap- Multi-Wallet ETH Transfer System (Monorepo)

A production-grade, highly optimized Web3 monorepo architecture for facilitating secure Ethereum transfers across multi-wallet infrastructures. Built with a strict focus on decoupled domain boundaries, deterministic local blockchain forking, automated task graphs, and enterprise continuous integration (CI) workflows.

## Architectural Core

This project is built as a highly structured workspace designed to replicate enterprise engineering patterns:
* **Package Separation:** Core crypto handling and blockchain node control are separated completely from the presentation layer, creating reusable code boundaries.
* **Smart Monorepo Management:** Uses **Nx** integrated over **pnpm workspaces** to handle local package indexing, caching, and smart task pipeline executions.
* **Deterministic Fork Simulation:** Integration tests spin up automated, in-memory **Anvil (Foundry)** instances that fork mainnet state at deterministic blocks.
* **Impact-Driven CI:** A workflow utilizing Git history diffing to only test, lint, and compile workspace domains directly affected by inbound commits.

---

## Stack & Tooling

### Monorepo Infrastructure
* **pnpm Workspaces:** Blazing fast disk-space utilization through global hard-linking and isolated package execution.
* **Nx Build Framework:** Orchestration layer handling parallel task scheduling, dependency graph tracking, and localized task caching.

### Web3 Core Engine (`packages/web3`)
* **TypeScript Core:** Configured with strict module resolution standards (`NodeNext`).
* **Ethers.js (v6):** Object-oriented blockchain abstractions for network providers, keys, transaction broadcasts, and gas processing.
* **Foundry (Anvil):** Local EVM development environment utilized programmatically for transaction sandbox environments.
* **Vitest:** High-velocity unit and integration testing engine.

### Client Presentation Layer (`apps/client`)
* **React & Vite:** Accelerated frontend compilation matching modern enterprise development requirements.
* **Tailwind CSS:** Fully responsive, production-ready utility styling framework.

---

## 🚀 Local Installation & Quick Start

### Prerequisites
* **Node.js** (v20 or higher recommended)
* **pnpm** (v9+)
* **Foundry Toolchain** (Requires `anvil` explicitly inside your system binary paths)
  ```bash
  curl -L https://paradigm.xyz | bash
  foundryup
  ```

### 1. Clone & Core Setup
```bash
git clone https://github.com
cd eth-transfer-app
pnpm install
```

### 2. Configure Environment Variables
Create a `.env` file inside `packages/web3/` (or supply via terminal):
```env
MAINNET_RPC_URL=https://llamarpc.com
```

### 3. Running Workspace Commands Via Nx

Run the frontend development application:
```bash
pnpm nx dev @app/client
```

Execute all testing suites across the monorepo:
```bash
pnpm nx run-many -t test
```

Lints and builds all internal workspaces simultaneously using concurrent workers:
```bash
pnpm nx run-many -t lint
pnpm nx run-many -t build
```

---

## 🧪 Production Testing Matrix

To guarantee reliability, the core Web3 transmission layer is tested against a live replica of Ethereum Mainnet. 

The test lifecycle operates as follows:
1. **Dynamic Instantiation:** `vitest` invokes a child shell process spawning `anvil --fork-url <RPC> --fork-block-number 20000000`.
2. **Health Check Probe:** The suite holds traffic execution until the programmatic JSON-RPC endpoint maps an open handshake.
3. **Transaction Execution:** Pre-funded ledger accounts execute standard transaction routines via `transferEth()`.
4. **State Assertion:** Destination block balance updates are asserted on-chain.
5. **Teardown Clean:** The node process kills its runtime cleanly, preserving system resource availability.

---

## 🛡️ Continuous Integration (CI) Workflow

The workspace includes an advanced `.github/workflows/ci.yml` pipeline that automates the verification of incoming Pull Requests:
* **Dependency Lock Checks:** Enforces strict deterministic updates through `--frozen-lockfile`.
* **Nx Affected Architecture:** Using Git SHA comparisons, the pipeline bypasses modules that have zero code modifications, keeping pipeline execution times minimal.
* **Secrets Injections:** Transparently forwards protected Ethereum environment hooks down into headless continuous delivery spaces.
