## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Sepolia deployment

The deployment script only broadcasts when Forge is run with `--broadcast` and
checks that the RPC is connected to Sepolia (chain ID `11155111`). Keep the RPC
URL in `packages/contracts/.env` and use an encrypted Foundry keystore for the
deployer key. Never commit `.env` or put a funded private key in source control.

1. Copy `.env.example` to `.env` and set `SEPOLIA_RPC_URL`,
   `DEPLOYER_ADDRESS`, and (for verification) `ETHERSCAN_API_KEY`.
2. Import the deployer into Foundry's encrypted keystore:

   ```shell
   cast wallet import sepolia-deployer --interactive
   ```

3. Run the local checks, then simulate the deployment without broadcasting:

   ```shell
   forge fmt --check
   forge build --sizes
   forge test -vvv
   forge script script/DeployTransferRouter.s.sol:DeployTransferRouter \
     --rpc-url "$SEPOLIA_RPC_URL" \
     --account sepolia-deployer \
     --sender "$DEPLOYER_ADDRESS"
   ```

4. Review the simulated sender, chain, gas estimate, and constructor address.
   After confirming the RPC and deployer, broadcast the same script:

   ```shell
   forge script script/DeployTransferRouter.s.sol:DeployTransferRouter \
     --rpc-url "$SEPOLIA_RPC_URL" \
     --account sepolia-deployer \
     --sender "$DEPLOYER_ADDRESS" \
     --broadcast
   ```

5. Record the deployed address and transaction hash from Forge's output, verify
   the source on Sepolia Etherscan, then configure the client with the address
   and Sepolia chain ID. Do not include deployment signing keys in CI.

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
