import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "gas-oracle",
  slug: "gas-oracle",
  description: "Current gas prices across chains — gwei tiers, USD cost estimates, congestion level.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/price",
      price: "$0.001",
      description: "Get current gas prices with slow/standard/fast/instant tiers",
      toolName: "gas_get_current_price",
      toolDescription: "Use this when you need current gas prices before submitting a transaction. Returns gas price in gwei (slow/standard/fast/instant), estimated cost in USD for a simple transfer and a swap, and network congestion level. Supports Base and Ethereum. Ideal for timing transactions, cost estimation, avoiding high gas periods. Do NOT use for swap quotes — use dex_get_swap_quote. Do NOT use for wallet balance — use wallet_get_portfolio.",
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
