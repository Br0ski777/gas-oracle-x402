# Gas Oracle API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://gas-oracle.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Live gas prices with gwei tiers, USD cost estimates, and congestion level. Time your transactions perfectly. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "gas-oracle": {
      "url": "https://gas-oracle.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl "https://gas-oracle.api.klymax402.com/api/price"
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `gas_get_current_price` | GET | `/api/price` | $0.001 | Get current gas prices with slow/standard/fast/instant tiers |

### `gas_get_current_price`

Use this when you need current gas prices before submitting a transaction. Returns gas tiers and USD cost estimates in JSON.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `chain` | string | no | Blockchain network (default: base) |

**Returns**

- `slow` -- gas price in gwei for slow confirmation (~5 min)
- `standard` -- gas price in gwei for standard confirmation (~2 min)
- `fast` -- gas price in gwei for fast confirmation (~30s)
- `instant` -- gas price in gwei for instant confirmation
- `transferCostUsd` -- estimated USD cost for a simple ETH transfer
- `swapCostUsd` -- estimated USD cost for a token swap
- `congestion` -- network congestion level (low/medium/high)

Example response:

```json
{"slow":0.008,"standard":0.012,"fast":0.018,"instant":0.025,"transferCostUsd":0.02,"swapCostUsd":0.05,"congestion":"low","chain":"base"}
```

**When to use**: submitting any on-chain transaction to pick the right gas tier. Essential for timing transactions and avoiding high-gas periods.

**Not for**: swap quotes (use `dex_get_swap_quote`), wallet balance (use `wallet_get_portfolio`).

## Example agent prompts

- "Current gas prices before submitting a transaction"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
