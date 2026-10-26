import { NearIntentsProvider } from "./near-intents";
import { SandboxProvider } from "./sandbox";
import type { SwapProvider } from "./types";

const providers: Record<string, SwapProvider> = {
  "near-intents": new NearIntentsProvider(),
  sandbox: new SandboxProvider(),
};

/** Live payments route through the configured provider. Test mode always uses the sandbox. */
export function providerFor(livemode: boolean): SwapProvider {
  if (!livemode) return providers.sandbox;
  return providers[process.env.LONA_LIVE_PROVIDER ?? "near-intents"] ?? providers["near-intents"];
}

export function providerByName(name: string): SwapProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider ${name}`);
  return p;
}

export * from "./types";
