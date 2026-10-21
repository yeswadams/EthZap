# EthZap

**A TypeScript and Solidity monorepo for multi-recipient Ethereum transfers.**

EthZap is a Web3 application for distributing ETH to multiple recipients through a single smart contract interaction. It combines a React client, a reusable TypeScript Web3 package, and Solidity contracts within a pnpm and Nx monorepo.

The project explores how to structure a blockchain application across frontend, Web3 integration, and smart contract boundaries while maintaining a testable development workflow.

> **Network:** Ethereum Sepolia  
> **Deployed contract:** [`0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092`](https://sepolia.etherscan.io/address/0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092)  
> **Status:** Testnet deployment completed. See the testing and limitations sections for the current scope.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Smart Contract](#smart-contract)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Sepolia Deployment](#sepolia-deployment)
- [Security Considerations](#security-considerations)
- [Current Limitations](#current-limitations)
- [Engineering Decisions](#engineering-decisions)
- [Contributing](#contributing)
- [License](#license)

## Overview

Sending ETH to multiple recipients individually requires multiple transaction submissions, wallet confirmations, and transaction records to track.

EthZap explores an alternative: collect a list of recipient addresses and amounts, validate the distribution, and execute the transfers through a single call to a Solidity smart contract.

The application is organized as a monorepo so the client, reusable Web3 logic, and smart contracts can evolve within clearly defined package boundaries.

### The problem

Multi-recipient ETH distribution introduces several engineering concerns:

- Validating recipient addresses and ETH amounts before submission.
- Converting human-readable ETH values into integer wei amounts accurately.
- Coordinating wallet signatures, transaction submission, and confirmation states.
- Handling failures without leaving partially completed distributions.
- Testing blockchain interactions in reproducible environments.
- Maintaining a codebase that can be built and tested across multiple packages.

EthZap provides a foundation for exploring these concerns in an integrated application.

## Features

| Capability | Description |
|---|---|
| Batch ETH transfers | Distribute ETH to multiple recipients through one contract call. |
| Solidity contract | Implements recipient transfers, custom errors, and execution events. |
| React client | Provides the application interface for configuring and submitting distributions. |
| Shared Web3 package | Separates blockchain interaction logic from the presentation layer. |
| Wallet integration | Connects frontend actions to the existing Web3 transaction workflow. |
| Monorepo orchestration | Uses pnpm workspaces and Nx to organize packages and execute tasks. |
| Contract testing | Supports Solidity development and local EVM testing with Foundry tooling. |
| Sepolia deployment | Includes a deployment script and a deployed testnet contract. |

Feature availability depends on the current implementation of each package. Mainnet deployment, transaction indexing, and production security certification are not implied by these capabilities.

## Architecture

EthZap separates application responsibilities into three primary workspace packages.

<pre>
EthZap/
├── apps/
│   └── client/       React + Vite frontend
├── packages/
│   ├── web3/         TypeScript blockchain integration
│   └── contracts/    Solidity contracts and Foundry scripts
├── nx.json
├── pnpm-workspace.yaml
└── package.json
</pre>

### Component responsibilities

**Client: `@app/client`**

The presentation layer handles user interaction and communicates with the Web3 integration. It should remain focused on rendering application state, collecting user input, and presenting transaction outcomes rather than duplicating low-level blockchain logic.

**Web3 integration: `@app/web3`**

The shared TypeScript package encapsulates blockchain interaction logic used by the client and tests. This separation creates a boundary between UI concerns and transaction execution.

**Smart contracts: `@app/contracts`**

The Solidity package contains the on-chain transfer logic, Foundry deployment scripts, and contract-related testing infrastructure.

**Workspace orchestration: pnpm + Nx**

pnpm manages workspace dependencies. Nx orchestrates configured project tasks and can use the workspace dependency graph for task scheduling and caching.

### Transaction flow

<pre>
User configures recipients and amounts
                 |
                 v
       Client-side validation
                 |
                 v
       Web3 integration layer
                 |
                 v
        Wallet signature
                 |
                 v
       Ethereum Sepolia RPC
                 |
                 v
          TransferRouter
                 |
        +--------+--------+
        |                 |
        v                 v
  ETH transfers      Events emitted
        |                 |
        +--------+--------+
                 |
                 v
       Transaction outcome
        returned to client
</pre>

The wallet authorizes the transaction, the RPC provider relays it to the network, and the contract executes the distribution. A successful wallet signature is not itself proof of successful on-chain execution.

## Technology Stack

| Technology | Responsibility |
|---|---|
| TypeScript | Typed application and Web3 integration code |
| React | Component-based frontend |
| Vite | Client development server and build tooling |
| Tailwind CSS | Utility-based interface styling |
| pnpm | Workspace and dependency management |
| Nx | Workspace task orchestration |
| Solidity | Smart contract implementation |
| Foundry | Contract compilation, scripting, and local EVM tooling |
| Anvil | Local Ethereum node and fork-based testing |
| Ethers.js v6 | Ethereum interaction abstractions used by the Web3 package |
| Vitest | JavaScript and TypeScript testing |

The versions used by each package are defined in the repository's package manifests and lockfile. Consult those files for the exact installed versions.

## Smart Contract

### TransferRouter

`TransferRouter` is the batch ETH transfer contract deployed on Sepolia.

**Contract address**

[`0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092`](https://sepolia.etherscan.io/address/0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092)

**Network:** Ethereum Sepolia  
**Chain ID:** `11155111`

### Interface

The contract exposes the following principal function:

```solidity
function batchTransferEth(
    address payable[] calldata recipients,
    uint256[] calldata amounts
) external payable;
```

Each array position represents one recipient and the corresponding amount in wei.

For example, the following conceptual distribution contains two transfers:

| Recipient | Amount |
|---|---:|
| Recipient A | 0.10 ETH |
| Recipient B | 0.25 ETH |
| **Total** | **0.35 ETH** |

The frontend must convert the amounts into wei before calling the contract. The example addresses and values above are illustrative, not a record of an executed transaction.

### Execution behavior

The current contract implementation:

1. Checks that the recipient and amount arrays have matching lengths.
2. Calculates the total requested distribution.
3. Attempts each ETH transfer using a low-level call.
4. Emits an `EthTransferred` event for each successful transfer.
5. Checks that the submitted ETH covers the requested total.
6. Emits `BatchCompleted` after the distribution.
7. Refunds excess ETH to the transaction sender.

If a transfer fails or a later validation reverts, the transaction reverts atomically. Previously executed transfers within that transaction are rolled back.

### Events

| Event | Purpose |
|---|---|
| `EthTransferred(address indexed recipient, uint256 amount)` | Records a recipient and the amount transferred. |
| `BatchCompleted(uint256 totalRecipients, uint256 totalAmount)` | Records the completed batch size and total distribution amount. |

These events can support transaction inspection and future activity indexing.

### Custom errors

| Error | Meaning |
|---|---|
| `ArrayLengthMismatch()` | The recipient and amount arrays have different lengths. |
| `TransferFailed(address recipient)` | An ETH transfer or refund failed for the specified address. |
| `InsufficientValueSent()` | The transaction supplied less ETH than the requested distribution total. |

### Important contract considerations

The contract currently performs external calls while iterating through recipients. A failed transfer reverts the complete transaction, but recipient contracts can execute code during these calls. Reentrancy behavior, gas-exhaustion scenarios, unusually large batches, and denial-of-service risks should be assessed before any production use.

The contract also checks whether sufficient ETH was supplied after attempting the recipient transfers. Because a revert rolls back the transaction, this does not allow recipients to retain an underfunded distribution. However, checking the total before making external calls would be a clearer and potentially more efficient design.

This documentation does not constitute a security audit.

## Repository Structure

The following describes the principal workspace boundaries. Refer to the actual directory contents for the complete file inventory.

```text
EthZap/
├── apps/
│   └── client/
│       └── src/
├── packages/
│   ├── web3/
│   │   └── src/
│   └── contracts/
│       ├── src/
│       ├── script/
│       ├── test/
│       └── foundry.toml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── nx.json
└── tsconfig.base.json
```

- `apps/client/src/` contains the client application.
- `packages/web3/src/` contains shared Web3 integration code.
- `packages/contracts/src/` contains Solidity contract source.
- `packages/contracts/script/` contains Foundry scripts, including `DeployTransferRouter.s.sol`.
- `packages/contracts/test/` is the expected location for Solidity tests if configured in the repository.

Some configuration files or directories may differ as the project evolves. Use the checked-in repository as the source of truth.

## Prerequisites

Install the following tools before running the project:

- Git
- Node.js compatible with the repository's configured toolchain
- pnpm, using the version specified by the repository if `packageManager` is set
- Foundry, including `forge`, `cast`, and `anvil`
- An Ethereum RPC endpoint for the network or fork used by your tests

Check your installed versions:

```bash
node --version
pnpm --version
git --version
forge --version
cast --version
anvil --version
```

Install Foundry by following the official [Foundry installation documentation](https://getfoundry.sh/introduction/installation/).

## Getting Started

### 1. Clone the repository

Replace the placeholder with the actual repository URL.

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd EthZap
```

### 2. Install workspace dependencies

```bash
pnpm install
```

If the repository pins pnpm through the root `package.json`, use that version for reproducible installs.

### 3. Inspect available projects and tasks

Before assuming that a task exists in every package, inspect the configured Nx project graph:

```bash
pnpm nx show projects
pnpm nx show project @app/client
pnpm nx show project @app/web3
pnpm nx show project @app/contracts
```

These commands help identify the actual project names and targets configured in the current checkout.

### 4. Start the client

If the client defines a `dev` target:

```bash
pnpm nx dev @app/client
```

Otherwise, inspect its available targets and use the configured development command:

```bash
pnpm nx show project @app/client
```

Open the local URL printed by the development server.

## Environment Configuration

Keep RPC URLs and other credentials out of source control.

The Web3 package and its tests may require RPC configuration depending on the execution path. For example, a mainnet-fork integration test may use:

```env
MAINNET_RPC_URL=https://your-mainnet-rpc-endpoint
```

Use a provider endpoint appropriate for your own development environment. Do not commit real provider credentials to `.env` files.

### Environment variable placement

Inspect the test and application configuration to determine where each variable is read. Do not assume that a `.env` file in the repository root is automatically loaded by every package or test runner.

A local shell can export a variable for the current session:

```bash
export MAINNET_RPC_URL="https://your-mainnet-rpc-endpoint"
```

For Sepolia deployment, configure an RPC endpoint in your shell:

```bash
export SEPOLIA_RPC_URL="https://your-sepolia-rpc-endpoint"
```

If your tests require a specific RPC variable, use the exact name referenced by the test configuration. Environment variables are not interchangeable unless the code explicitly maps them.

## Development Workflow

Run workspace commands from the repository root.

### Run tests

To execute all projects that expose an Nx `test` target:

```bash
pnpm nx run-many -t test
```

To test the Web3 package directly:

```bash
pnpm nx run @app/web3:test --skip-nx-cache
```

The command above is useful when diagnosing cached versus fresh test results. It requires the project to define the `test` target.

### Build the client

```bash
pnpm nx build @app/client
```

### Build all configured projects

```bash
pnpm nx run-many -t build
```

### Run lint checks

```bash
pnpm nx run-many -t lint
```

The `build`, `test`, and `lint` commands operate only on targets configured in the workspace. If Nx reports that a target is missing, inspect the relevant project's configuration instead of assuming the task exists.

### Inspect the dependency graph

```bash
pnpm nx graph
```

The graph helps explain project dependencies and can assist with debugging task ordering, package boundaries, and affected-project execution.

## Testing Strategy

EthZap uses Vitest for TypeScript and JavaScript testing and Foundry tooling for Solidity development and local EVM execution.

### Unit tests

Unit tests should validate deterministic behavior without depending on a live blockchain wherever possible.

Relevant areas include:

- Recipient and amount validation.
- ETH-to-wei conversion.
- Distribution aggregation.
- Error handling and transaction state transitions.
- Contract helper behavior.

Only claim coverage for test cases that actually exist and run successfully in the repository.

### Integration tests

The Web3 integration tests can use Anvil to provide a local EVM. A forked environment can execute transactions against a snapshot of historical chain state without broadcasting those test transactions to the public network.

The general lifecycle is:

1. Configure an RPC endpoint for the chain being forked.
2. Start an Anvil instance with the required fork settings.
3. Wait for the local JSON-RPC endpoint to become available.
4. Execute the relevant integration scenarios.
5. Assert the resulting balances, return values, or transaction outcomes.
6. Stop the local node and clean up test resources.

A representative command for a mainnet fork at block `20000000` is:

```bash
anvil \
  --fork-url "$MAINNET_RPC_URL" \
  --fork-block-number 20000000
```

This command illustrates the fork configuration. Use the test suite's actual startup mechanism and port configuration when running automated tests.

Pinning a fork block makes the initial chain state more reproducible. It does not guarantee complete determinism if tests also depend on external services, timestamps, configuration, or unpinned tooling.

### Smart contract tests

Contract tests should cover at least:

- Successful transfers to one and multiple recipients.
- Mismatched recipient and amount arrays.
- Insufficient ETH supplied.
- Excess ETH refund behavior.
- Failed recipient transfers and full transaction rollback.
- Emitted events and their values.
- Boundary conditions, including empty arrays and zero-value transfers.
- Interactions with recipient contracts that execute code on receipt.

Run the actual Foundry test suite using:

```bash
cd packages/contracts
forge test -vvv
```

This command assumes the contracts package uses the standard Foundry layout and has tests configured.

### Current verification boundary

A successful contract deployment confirms that the deployment transaction completed. It does not establish that every contract behavior is correct or that the complete application has been comprehensively tested.

Test results should be reproducible from the current repository checkout before being represented as verified project capabilities.

## Sepolia Deployment

EthZap's `TransferRouter` has been deployed to Ethereum Sepolia.

| Property | Value |
|---|---|
| Network | Ethereum Sepolia |
| Chain ID | `11155111` |
| Contract | `TransferRouter` |
| Address | `0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092` |
| Explorer | [View contract on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x9A5b9FB6E6369d474D4db186238c17F8B8Ae9092) |
| Deployment transaction | [View transaction](https://sepolia.etherscan.io/tx/0x89f712d89264d2a7a03d3180b258024ae3d4f43d851c048bd616538a8a90fbe6) |

### Deploying with Foundry

The deployment script is located at:

```text
packages/contracts/script/DeployTransferRouter.s.sol
```

The script restricts deployment to Sepolia by checking the chain ID.

From the contracts package, configure your RPC endpoint and ensure your Foundry deployer account is already set up:

```bash
export SEPOLIA_RPC_URL="https://your-sepolia-rpc-endpoint"
```

Inspect the deployment script and Foundry account configuration before running a deployment.

A simulation can be run with:

```bash
FOUNDRY_EVM_VERSION=prague forge script \
  script/DeployTransferRouter.s.sol:DeployTransferRouter \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --account sepolia-deployer \
  --sender 0x6a138fa57fd0990bc079315314ea94e1dd597e60 \
  --gas-estimate-multiplier 800
```

The sender address above is the deployer used for the recorded deployment. Use your own authorized account when deploying a separate instance.

To broadcast, append `--broadcast` only after reviewing the simulation, confirming the chain and deployer, and ensuring sufficient test ETH:

```bash
FOUNDRY_EVM_VERSION=prague forge script \
  script/DeployTransferRouter.s.sol:DeployTransferRouter \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --account sepolia-deployer \
  --sender 0x6a138fa57fd0990bc079315314ea94e1dd597e60 \
  --gas-estimate-multiplier 800 \
  --broadcast
```

The multiplier is part of the recorded workflow, not a universal recommendation for every deployment. Reassess gas estimates for changed contract bytecode and execution environments.

### Verify a deployment

After broadcasting, inspect the transaction receipt:

```bash
cast receipt <TRANSACTION_HASH> \
  --rpc-url "$SEPOLIA_RPC_URL"
```

Check the contract's deployed bytecode:

```bash
cast code <CONTRACT_ADDRESS> \
  --rpc-url "$SEPOLIA_RPC_URL"
```

Confirm that the receipt reports a successful status and that the code result is not `0x`.

Do not publish private keys, keystore passwords, RPC provider secrets, or unredacted environment files.

## Security Considerations

Blockchain transactions are irreversible once finalized under the network's consensus assumptions. EthZap should treat validation, transaction review, and error reporting as critical application responsibilities.

### Input validation

- Validate recipient addresses before submission.
- Ensure the recipient and amount arrays have identical lengths.
- Reject malformed, negative, or unsupported-precision ETH values.
- Convert ETH to wei without floating-point arithmetic errors.
- Display the full distribution total before the user signs.

### Transaction lifecycle

The client should distinguish between awaiting wallet approval, pending execution, confirmed success, and failure. A wallet approval is not equivalent to successful execution.

Avoid automatic retries when a previous transaction may already have been submitted. Use transaction hashes and receipts to establish outcomes.

### Contract behavior

The current contract uses low-level external calls to send ETH. External calls introduce reentrancy and gas-related considerations that must be assessed for the intended use case.

Before considering production deployment, review:

- Reentrancy and external-call behavior.
- Gas limits and maximum practical batch sizes.
- Recipient contracts that reject ETH or execute arbitrary code.
- Refund behavior and recipient compatibility.
- Input validation and overflow behavior.
- Deployment access and operational procedures.

### RPC and secrets management

- Keep RPC provider API keys out of version control.
- Use environment variables or an appropriate secret-management system.
- Restrict provider keys when the provider supports access controls.
- Never ask users to enter seed phrases or private keys into the application.

### Testnet versus production

Sepolia is intended for testing and development. This deployment is not evidence that the contract has been audited, formally verified, or approved for mainnet use.

Do not send real funds to the testnet contract under the assumption that testnet testing establishes production safety.

## Current Limitations

EthZap should be evaluated according to what is implemented and verified in the current checkout.

- **Testnet scope:** The documented deployment targets Ethereum Sepolia, not Ethereum mainnet.
- **Transaction history:** Historical indexing requires an explicit data source or indexing implementation. A transaction hash alone does not provide a complete historical activity feed.
- **Gas estimation:** Estimates depend on the RPC provider, current network conditions, and transaction parameters.
- **Contract security:** The project documentation does not claim an independent security audit.
- **Batch size:** Practical recipient counts depend on transaction gas limits, recipient behavior, and network conditions.
- **Test coverage:** The existence of test infrastructure does not establish that every listed scenario is covered or passing.
- **CI guarantees:** Pipeline behavior depends on the workflows and task configurations actually present in the repository.

These limitations are intentional documentation boundaries: they separate established implementation details from future engineering work.

## Engineering Decisions

### Monorepo over independent repositories

A monorepo keeps the client, shared Web3 integration, and contracts within one version-controlled project. It simplifies coordinated changes to shared interfaces and allows workspace tasks to be orchestrated together.

The trade-off is that package boundaries must be maintained deliberately to avoid unnecessary coupling.

### pnpm workspaces and Nx

pnpm manages dependency installation and workspace linking, while Nx coordinates configured project tasks and their dependencies.

Nx caching and affected-project execution can reduce unnecessary work, but their benefits depend on correct task inputs, outputs, dependency relationships, and CI configuration.

### Separate Web3 logic from presentation

A dedicated Web3 package keeps blockchain interaction code reusable and independently testable. This also makes it easier to distinguish UI defects from wallet, RPC, and contract execution failures.

### Local EVM testing

Anvil provides a local environment for executing and debugging blockchain interactions. Fork-based testing allows integration scenarios to run against a snapshot of chain state without using public-network transactions for each test.

### Explicit on-chain behavior

The contract exposes events and custom errors to make execution outcomes easier to inspect. These interfaces provide useful building blocks for frontend feedback, testing, and future transaction indexing.

## Contributing

Contributions should preserve the separation between client, Web3 integration, and contract responsibilities.

A typical contribution workflow is:

1. Create a branch for the change.
2. Make the smallest coherent implementation change.
3. Add or update tests for affected behavior.
4. Run the relevant Nx targets and Foundry tests.
5. Review transaction safety, types, and failure handling.
6. Open a pull request describing the problem, implementation, testing performed, and any known limitations.

Do not commit secrets, generated build artifacts that are excluded by the project, or unrelated formatting changes.

## License

Add the project's actual license here once it is established in the repository. Until a license is present, do not assume the code is licensed for unrestricted reuse.

---

**EthZap is an ongoing engineering project.** The repository, contract source, deployment transaction, and reproducible test results are the appropriate sources of truth for evaluating its implementation and maturity.