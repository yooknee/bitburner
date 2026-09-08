import { NS } from "@ns";
import { fleet } from "lib/target";
import { G, H, HOME_RESERVE, SPACING, W, planBatch, workerCosts } from "lib/hwgw";

/**
 * HWGW batcher for one target.
 *
 * usage: run hwgw/batch.js <target> [stealFraction] [budgetGB]
 *
 * budgetGB caps how much RAM this controller will hold in flight, so several
 * controllers can share one fleet without starving each other. Omit it and the
 * controller will happily eat everything.
 */
export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string;
  if (!target) { ns.tprint("usage: run hwgw/batch.js <target> [stealFraction] [budgetGB]"); return; }

  const STEAL = (ns.args[1] as number) ?? 0.1;
  const BUDGET = (ns.args[2] as number) ?? Infinity;

  const COST = workerCosts(ns);
  if (Object.values(COST).some((c) => c === 0)) { ns.tprint("ERROR: workers missing from home."); return; }

  ns.disableLog("ALL");
  ns.ui.openTail();
  ns.ui.setTailTitle(`batch ${target}`);

  const freeRam = (host: string) =>
    ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - (host === "home" ? HOME_RESERVE : 0);

  // Discovering the network costs one ns.scan per server, and it barely changes.
  // At ~1.25 batches/sec across three controllers that was thousands of NS calls
  // a second, which the game charges real time for — the loop couldn't keep up
  // with SPACING, so concurrency never reached the level the budget assumed.
  let fleetCache: string[] = [];
  let fleetAt = 0;
  const hosts = (): string[] => {
    if (Date.now() - fleetAt > 10_000) { fleetCache = fleet(ns); fleetAt = Date.now(); }
    return fleetCache;
  };

  interface Slot { host: string; free: number; }

  /**
   * Snapshot free RAM once per batch, then place all four operations against it.
   *
   * Previously each placement re-queried every host and called freeRam inside a
   * sort comparator — O(n log n) NS calls per operation. Decorating once and
   * sorting the decorated values is what Python's `key=` does for free.
   */
  const snapshot = (): Slot[] => {
    const slots = hosts()
      .map((host) => ({ host, free: Math.max(0, freeRam(host)) }))
      .filter((s) => s.free > 0);

    const remote = slots.filter((s) => s.host !== "home").sort((a, b) => b.free - a.free);
    const home = slots.filter((s) => s.host === "home");
    return [...remote, ...home];   // home last: controllers live there, and you work there
  };

  const fleetFree = (slots: Slot[]) => slots.reduce((sum, s) => sum + s.free, 0);

  // Batches we've launched that haven't finished, so we can respect BUDGET
  // without asking the game what belongs to whom.
  let inFlight: { until: number; ram: number }[] = [];
  const held = () => {
    const now = Date.now();
    inFlight = inFlight.filter((b) => b.until > now);
    return inFlight.reduce((sum, b) => sum + b.ram, 0);
  };

  /** Spread `threads` of `script` across the snapshot. Returns how many started. */
  const place = (slots: Slot[], script: string, threads: number, delayMs: number): number => {
    let left = Math.ceil(threads);
    for (const slot of slots) {
      if (left <= 0) break;
      const fit = Math.floor(slot.free / COST[script]);
      if (fit < 1) continue;

      const n = Math.min(fit, left);
      // The worker is already there after the first batch; re-copying is a
      // wasted NS call on every host, every operation, forever.
      if (slot.host !== "home" && !ns.fileExists(script, slot.host)) ns.scp(script, slot.host, "home");

      // Unique last arg: without it the game rejects a second copy of the same
      // script with the same args on one host, and batches overlap by design.
      // A refusal skips that host rather than abandoning the whole placement.
      if (ns.exec(script, slot.host, n, target, delayMs, `${Date.now()}-${Math.random()}`) === 0) continue;

      slot.free -= n * COST[script];   // keep the snapshot honest as we fill it
      left -= n;
    }
    return Math.ceil(threads) - left;
  };

  /** Grow and weaken the target into the state every batch assumes. */
  const prep = async (): Promise<void> => {
    for (;;) {
      const s = ns.getServer(target);
      const overSec = (s.hackDifficulty ?? 0) - (s.minDifficulty ?? 0);
      const shortMoney = (s.moneyMax ?? 0) - (s.moneyAvailable ?? 0);
      if (overSec < 0.05 && shortMoney < 1) return;

      const player = ns.getPlayer();
      const perWeaken = ns.formulas.hacking.weakenEffect(1);

      if (overSec > 0.05) {
        place(snapshot(), W, Math.ceil(overSec / perWeaken), 0);
      } else {
        const grows = Math.ceil(ns.formulas.hacking.growThreads(s, player, s.moneyMax ?? 0));
        const slots = snapshot();
        place(slots, G, grows, 0);
        place(slots, W, Math.ceil(ns.growthAnalyzeSecurity(grows, target) / perWeaken), 0);
      }

      ns.print(`prep: security +${overSec.toFixed(2)}, money ${(100 * (s.moneyAvailable ?? 0) / (s.moneyMax ?? 1)).toFixed(1)}%`);
      await ns.sleep(ns.formulas.hacking.weakenTime(s, player) + 500);
    }
  };

  const plan = () => planBatch(ns, target, STEAL, COST);

  ns.print(`prepping ${target}...`);
  await prep();

  let batches = 0;
  let starved = 0;

  for (;;) {
    const s = ns.getServer(target);

    // Desync guard. If security climbed or money fell, the durations we planned
    // with are stale and everything in flight is landing in the wrong order.
    if ((s.hackDifficulty ?? 0) > (s.minDifficulty ?? 0) + 1 ||
        (s.moneyAvailable ?? 0) < (s.moneyMax ?? 0) * 0.9) {
      ns.print(`desynced after ${batches} batches - re-prepping`);
      await prep();
      batches = 0;
    }

    const p = plan();
    if (!p) { ns.print("target yields nothing at this level."); return; }

    const slots = snapshot();
    const room = Math.min(fleetFree(slots), BUDGET - held());

    if (p.ram > room) {
      starved++;
      if (starved % 25 === 1) ns.print(`no room: need ${p.ram.toFixed(0)}GB, have ${room.toFixed(0)}GB`);
    } else {
      for (const op of p.ops) place(slots, op.script, op.threads, op.delay);
      inFlight.push({ until: Date.now() + p.window, ram: p.ram });
      batches++;
      if (batches % 20 === 0) {
        ns.print(`${batches} batches | ${(p.stolen * 100).toFixed(1)}%/batch | ${p.ram.toFixed(0)}GB each | ${held().toFixed(0)}GB held`);
      }
    }

    await ns.sleep(SPACING);
  }
}
