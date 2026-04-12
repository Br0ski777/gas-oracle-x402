import type { Hono } from "hono";

// --- RPC Config ---
const RPC_URLS: Record<string, string> = {
  base: "https://mainnet.base.org",
  ethereum: "https://eth.llamarpc.com",
};

// --- Price cache ---
let ethPriceCache: { price: number; ts: number } = { price: 0, ts: 0 };
const PRICE_TTL = 60_000; // 60s

async function getEthPrice(): Promise<number> {
  if (Date.now() - ethPriceCache.ts < PRICE_TTL && ethPriceCache.price > 0) {
    return ethPriceCache.price;
  }
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json() as { ethereum: { usd: number } };
    ethPriceCache = { price: data.ethereum.usd, ts: Date.now() };
    return data.ethereum.usd;
  } catch {
    return ethPriceCache.price > 0 ? ethPriceCache.price : 2500;
  }
}

// --- RPC helpers ---
async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function hexToGwei(hex: string): number {
  return Number(BigInt(hex)) / 1e9;
}

function gweiToEth(gwei: number, gasUnits: number): number {
  return (gwei * gasUnits) / 1e9;
}

function getCongestionLevel(baseFeeGwei: number, chain: string): "low" | "medium" | "high" {
  if (chain === "base") {
    if (baseFeeGwei < 0.01) return "low";
    if (baseFeeGwei < 0.1) return "medium";
    return "high";
  }
  // Ethereum
  if (baseFeeGwei < 15) return "low";
  if (baseFeeGwei < 40) return "medium";
  return "high";
}

// --- Route handler ---
export function registerRoutes(app: Hono) {
  app.get("/api/price", async (c) => {
    const chain = (c.req.query("chain") || "base").toLowerCase();

    if (!RPC_URLS[chain]) {
      return c.json({ error: `Unsupported chain: ${chain}. Use 'base' or 'ethereum'.` }, 400);
    }

    const rpcUrl = RPC_URLS[chain];

    try {
      // Fetch gas price, fee history, and ETH price in parallel
      const [gasPriceHex, feeHistoryRaw, ethPrice] = await Promise.all([
        rpcCall(rpcUrl, "eth_gasPrice", []) as Promise<string>,
        rpcCall(rpcUrl, "eth_feeHistory", ["0x14", "latest", [10, 25, 50, 75, 90]]) as Promise<{
          baseFeePerGas: string[];
          reward: string[][];
          gasUsedRatio: number[];
        }>,
        getEthPrice(),
      ]);

      const currentGasPriceGwei = hexToGwei(gasPriceHex);

      // Parse fee history for EIP-1559
      const baseFees = feeHistoryRaw.baseFeePerGas.map(hexToGwei);
      const latestBaseFee = baseFees[baseFees.length - 1];

      // Calculate priority fee percentiles from reward data
      const priorityFees = {
        slow: 0,
        standard: 0,
        fast: 0,
        instant: 0,
      };

      if (feeHistoryRaw.reward && feeHistoryRaw.reward.length > 0) {
        // reward[block][percentileIndex] — percentiles: [10, 25, 50, 75, 90]
        const p10: number[] = [];
        const p25: number[] = [];
        const p50: number[] = [];
        const p90: number[] = [];

        for (const blockRewards of feeHistoryRaw.reward) {
          if (blockRewards.length >= 5) {
            p10.push(hexToGwei(blockRewards[0]));
            p25.push(hexToGwei(blockRewards[1]));
            p50.push(hexToGwei(blockRewards[2]));
            p90.push(hexToGwei(blockRewards[4]));
          }
        }

        const median = (arr: number[]) => {
          if (arr.length === 0) return 0;
          const sorted = [...arr].sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length / 2)];
        };

        priorityFees.slow = median(p10);
        priorityFees.standard = median(p25);
        priorityFees.fast = median(p50);
        priorityFees.instant = median(p90);
      }

      // Total gas price per tier
      const gasPrice = {
        slow: round(latestBaseFee + priorityFees.slow),
        standard: round(latestBaseFee + priorityFees.standard),
        fast: round(latestBaseFee + priorityFees.fast),
        instant: round(latestBaseFee + priorityFees.instant),
      };

      // Estimate USD costs
      const TRANSFER_GAS = 21_000;
      const SWAP_GAS = 150_000;

      const estimatedCost = {
        transfer: {
          gasUnits: TRANSFER_GAS,
          slow: round(gweiToEth(gasPrice.slow, TRANSFER_GAS) * ethPrice, 6),
          standard: round(gweiToEth(gasPrice.standard, TRANSFER_GAS) * ethPrice, 6),
          fast: round(gweiToEth(gasPrice.fast, TRANSFER_GAS) * ethPrice, 6),
          instant: round(gweiToEth(gasPrice.instant, TRANSFER_GAS) * ethPrice, 6),
        },
        swap: {
          gasUnits: SWAP_GAS,
          slow: round(gweiToEth(gasPrice.slow, SWAP_GAS) * ethPrice, 4),
          standard: round(gweiToEth(gasPrice.standard, SWAP_GAS) * ethPrice, 4),
          fast: round(gweiToEth(gasPrice.fast, SWAP_GAS) * ethPrice, 4),
          instant: round(gweiToEth(gasPrice.instant, SWAP_GAS) * ethPrice, 4),
        },
      };

      // Gas used ratio average for congestion
      const avgGasUsedRatio = feeHistoryRaw.gasUsedRatio.length > 0
        ? feeHistoryRaw.gasUsedRatio.reduce((a, b) => a + b, 0) / feeHistoryRaw.gasUsedRatio.length
        : 0;

      const congestion = getCongestionLevel(latestBaseFee, chain);

      return c.json({
        chain,
        baseFeeGwei: round(latestBaseFee),
        priorityFeeGwei: {
          slow: round(priorityFees.slow),
          standard: round(priorityFees.standard),
          fast: round(priorityFees.fast),
          instant: round(priorityFees.instant),
        },
        gasPriceGwei: gasPrice,
        legacyGasPriceGwei: round(currentGasPriceGwei),
        estimatedCostUsd: estimatedCost,
        ethPriceUsd: ethPrice,
        congestion,
        networkUtilization: round(avgGasUsedRatio * 100, 1) + "%",
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      return c.json({ error: "RPC error: " + e.message }, 502);
    }
  });
}

function round(n: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
