"use client";

import { useEffect, useRef, useState } from "react";
import type { InvoiceStatus } from "@/db/schema";
import { PayPanel } from "@/components/pay-panel";
import { PayoutCard } from "./notice-cards";
import { WalletPhone, type WalletState } from "./wallet-phone";
import type { DemoQuote } from "@/lib/pricing";

const DEMO = {
  id: "inv_demo_hero_scene_01",
  merchant: "Kiln Coffee",
  address: "t1Tj9cSiNQJbCmuFVPqkQhuvT2hkMEcmzoB",
};

type Frame = { at: number; status: InvoiceStatus; wallet: WalletState; payout: boolean; hooks: number };

// One loop, 13 seconds. Each frame is the state from `at` (ms) until the next frame.
const TIMELINE: Frame[] = [
  { at: 0, status: "awaiting_payment", wallet: "review", payout: false, hooks: 0 },
  { at: 2200, status: "awaiting_payment", wallet: "pressing", payout: false, hooks: 0 },
  { at: 2700, status: "awaiting_payment", wallet: "sent", payout: false, hooks: 0 },
  { at: 3900, status: "payment_received", wallet: "sent", payout: false, hooks: 1 },
  { at: 6200, status: "converting", wallet: "sent", payout: false, hooks: 1 },
  { at: 8600, status: "paid_out", wallet: "sent", payout: true, hooks: 2 },
];
const LOOP_MS = 13000;
const FINAL = TIMELINE[TIMELINE.length - 1];

export function HeroScene({ demo }: { demo: DemoQuote }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!playing || reduced) return;
    const start = performance.now() - t;
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      const next = (now - start) % LOOP_MS;
      // Only re-render when the frame changes or every 250ms for the timer.
      const bucket = Math.floor(next / 250);
      if (bucket !== last) {
        last = bucket;
        setT(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduced]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / 600)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frame = reduced ? FINAL : [...TIMELINE].reverse().find((f) => t >= f.at) ?? TIMELINE[0];
  const fading = !reduced && t > LOOP_MS - 700;
  const secondsLeft = Math.max(0, 1200 - Math.floor(t / 1000));
  const timer = { label: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`, fraction: secondsLeft / 1200 };

  return (
    <div className="hero-stage-wrap" ref={stageRef} style={{ height: 680 * scale }}>
      <div className={`hero-stage ${fading ? "is-fading" : ""}`} style={{ transform: `scale(${scale})` }}>
        <div className="hs-panel">
          <div className="hs-panel-top">
            <span className="small" style={{ fontWeight: 600 }}>{DEMO.merchant}</span>
            <span className="small soft">Order 1042, {demo.usd} USD</span>
          </div>
          <PayPanel
            key={reduced ? "static" : Math.floor(t / LOOP_MS)}
            id={DEMO.id}
            status={frame.status}
            merchantName={DEMO.merchant}
            settleSymbol="USDC"
            amount={demo.usd}
            payment={{ zecAmount: demo.zec, zecUsd: demo.zecUsd, depositAddress: DEMO.address }}
            timer={timer}
            frameSize={236}
          />
        </div>
        <div className="hs-phone">
          <WalletPhone state={frame.wallet} amount={demo.zec} address={DEMO.address} />
        </div>
        <div className="hs-payout">
          <PayoutCard visible={frame.payout} amount={demo.usd} network="Base" />
        </div>
      </div>
      {!reduced && (
        <button type="button" className="hs-toggle" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2l7 4-7 4z" fill="currentColor" /></svg>
          )}
          {playing ? "Pause demo" : "Play demo"}
        </button>
      )}
    </div>
  );
}
