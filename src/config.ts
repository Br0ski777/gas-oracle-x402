import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "gas-oracle",
  slug: "gas-oracle",
  description: "Live gas prices with gwei tiers, USD cost estimates, and congestion level. Time your transactions perfectly.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/price",
      price: "$0.001",
      description: "Get current gas prices with slow/standard/fast/instant tiers",
      toolName: "gas_get_current_price",
      toolDescription: `Use this when you need current gas prices before submitting a transaction. Returns gas tiers and USD cost estimates in JSON.

1. slow: gas price in gwei for slow confirmation (~5 min)
2. standard: gas price in gwei for standard confirmation (~2 min)
3. fast: gas price in gwei for fast confirmation (~30s)
4. instant: gas price in gwei for instant confirmation
5. transferCostUsd: estimated USD cost for a simple ETH transfer
6. swapCostUsd: estimated USD cost for a token swap
7. congestion: network congestion level (low/medium/high)

Example output: {"slow":0.008,"standard":0.012,"fast":0.018,"instant":0.025,"transferCostUsd":0.02,"swapCostUsd":0.05,"congestion":"low","chain":"base"}

Use this BEFORE submitting any on-chain transaction to pick the right gas tier. Essential for timing transactions and avoiding high-gas periods.

Do NOT use for swap quotes -- use dex_get_swap_quote instead. Do NOT use for wallet balance -- use wallet_get_portfolio instead. Do NOT use for multi-chain gas comparison -- use crypto_estimate_gas instead.`,
      inputSchema: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            enum: ["base", "ethereum"],
            description: "Blockchain network (default: base)",
          },
        },
      },
    },
  ],
};
