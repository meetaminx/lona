/**
 * Settlement assets a merchant can be paid out in, and the Zcash asset customers pay with.
 *
 * `blockchain` and `symbol` match the 1Click /v0/tokens list, which is the source of truth for
 * asset IDs at runtime. `assetIdHint` is used only if the token list cannot be reached.
 */

export type ChainFamily = "evm" | "solana";

export type SettlementAsset = {
  key: string;
  symbol: "USDC" | "USDT";
  chainName: string;
  blockchain: string;
  family: ChainFamily;
  decimals: number;
  contractAddress: string;
  assetIdHint: string;
};

export const SETTLEMENT_ASSETS: SettlementAsset[] = [
  {
    key: "usdc-base",
    symbol: "USDC",
    chainName: "Base",
    blockchain: "base",
    family: "evm",
    decimals: 6,
    contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    assetIdHint: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  },
  {
    key: "usdc-arbitrum",
    symbol: "USDC",
    chainName: "Arbitrum",
    blockchain: "arb",
    family: "evm",
    decimals: 6,
    contractAddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    assetIdHint: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
  },
  {
    key: "usdc-ethereum",
    symbol: "USDC",
    chainName: "Ethereum",
    blockchain: "eth",
    family: "evm",
    decimals: 6,
    contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    assetIdHint: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
  },
  {
    key: "usdc-solana",
    symbol: "USDC",
    chainName: "Solana",
    blockchain: "sol",
    family: "solana",
    decimals: 6,
    contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    assetIdHint: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
  },
  {
    key: "usdt-ethereum",
    symbol: "USDT",
    chainName: "Ethereum",
    blockchain: "eth",
    family: "evm",
    decimals: 6,
    contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    assetIdHint: "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near",
  },
];

export const ZEC = {
  symbol: "ZEC",
  blockchain: "zec",
  decimals: 8,
  assetIdHint: "nep141:zec.omft.near",
} as const;

export function getSettlementAsset(key: string): SettlementAsset | undefined {
  return SETTLEMENT_ASSETS.find((a) => a.key === key);
}

export function assetLabel(asset: SettlementAsset): string {
  return `${asset.symbol} on ${asset.chainName}`;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Returns an error message for the merchant, or null if the address looks valid. */
export function checkPayoutAddress(asset: SettlementAsset, address: string): string | null {
  const a = address.trim();
  if (asset.family === "evm") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) {
      return `That is not a ${asset.chainName} address. ${asset.chainName} addresses start with 0x and are 42 characters long.`;
    }
    return null;
  }
  if (!BASE58.test(a) || a.length < 32 || a.length > 44) {
    return "That is not a Solana address. Solana addresses are 32 to 44 characters of letters and numbers, with no 0x prefix.";
  }
  return null;
}

/**
 * Refunds from the swap network go back to a transparent Zcash address (t1 or t3).
 * Shielded and unified addresses are not accepted as refund targets by the network today.
 */
export function checkZcashRefundAddress(address: string): string | null {
  const a = address.trim();
  if (!/^t[13][1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) {
    return "Refunds need a transparent Zcash address, which starts with t1 or t3 and is 35 characters long.";
  }
  return null;
}
