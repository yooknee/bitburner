import { NS } from "@ns";
import { prepped } from "lib/target";

export const W = "hwgw/w.js", G = "hwgw/g.js", H = "hwgw/h.js";

export const GAP = 200;            // ms between landings inside one batch
export const SPACING = 4 * GAP;    // ms between batch launches
export const HOME_RESERVE = 32;    // GB kept free on home so you can still work

export interface Batch {
  stolen: number;
  window: number;                  // ms from first start to last landing
  ram: number;
  ops: { script: string; threads: number; delay: number }[];
}

export function workerCosts(ns: NS): Record<string, number> {
  return { [W]: ns.getScriptRam(W, "home"), [G]: ns.getScriptRam(G, "home"), [H]: ns.getScriptRam(H, "home") };
}

/**
 * Thread counts and start offsets for one batch against `target`, assuming the
 * target is at max money and min security — the state prep guarantees and every
 * completed batch restores.
 */
export function planBatch(ns: NS, target: string, steal: number, cost: Record<string, number>): Batch | null {
  const p = prepped(ns, target);
  if (!p) return null;

  const player = ns.getPlayer();
  const f = ns.formulas.hacking;
  const perWeaken = f.weakenEffect(1);

  const perThread = f.hackPercent(p.server, player);
  if (perThread <= 0) return null;

  // floor: overshooting the steal target is worse than undershooting.
  const hackT = Math.max(1, Math.floor(steal / perThread));
  const stolen = hackT * perThread;
  const weaken1T = Math.ceil(ns.hackAnalyzeSecurity(hackT, target) / perWeaken);

  // growThreads needs the server in its POST-hack state to know the shortfall.
  // 5% over-grow as insurance: overshooting is free (money caps at max),
  // undershooting compounds batch after batch until the target drains.
  const postHack = { ...p.server, moneyAvailable: p.moneyMax * (1 - stolen) };
  const growT = Math.ceil(f.growThreads(postHack, player, p.moneyMax) * 1.05);
  const weaken2T = Math.ceil(ns.growthAnalyzeSecurity(growT, target) / perWeaken);

  const Th = f.hackTime(p.server, player);
  const Tg = f.growTime(p.server, player);
  const Tw = f.weakenTime(p.server, player);

  // Landings sit at t0, t0+GAP, t0+2GAP, t0+3GAP. Choosing t0 = Tw - GAP puts
  // the earliest start (weaken1) at exactly zero. Start = landing - duration,
  // which is why the start order (w1, w2, g, h) is not the landing order.
  return {
    stolen,
    window: Tw + 3 * GAP,
    ram: hackT * cost[H] + growT * cost[G] + (weaken1T + weaken2T) * cost[W],
    ops: [
      { script: W, threads: weaken1T, delay: 0 },
      { script: W, threads: weaken2T, delay: 2 * GAP },
      { script: G, threads: growT, delay: Math.max(0, Tw + GAP - Tg) },
      { script: H, threads: hackT, delay: Math.max(0, Tw - GAP - Th) },
    ],
  };
}

/**
 * The most RAM a single target can usefully absorb.
 *
 * A batch occupies its window; we launch one every SPACING. So at most
 * window/SPACING batches are ever in flight, and RAM beyond that just sits
 * idle. This is why pointing every server at one target stops helping — and
 * the number that tells you when to spread out.
 */
export function saturationRam(batch: Batch): number {
  return batch.ram * Math.ceil(batch.window / SPACING);
}
