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

  const fleetFree = () => fleet(ns).reduce((sum, h) => sum + Math.max(0, freeRam(h)), 0);

  // Batches we've launched that haven't finished yet, so we can respect BUDGET
  // without asking the game what belongs to whom.
  let inFlight: { until: number; ram: number }[] = [];
  const held = () => {
    const now = Date.now();
    inFlight = inFlight.filter((b) => b.until > now);
    return inFlight.reduce((sum, b) => sum + b.ram, 0);
  };

  /**
   * Placement order: biggest remote server first, home last.
   *
   * fleet() returns hosts in BFS order, which puts home first because it's the
   * seed — and filling home first means the rest of the network sits idle
   * whenever one batch fits on home alone. Home is the machine to spend last:
   * the controllers live there and you work there.
   */
  const hosts = (): string[] => {
    const all = fleet(ns);
    const remote = all.filter((h) => h !== "home").sort((a, b) => freeRam(b) - freeRam(a));
    return all.includes("home") ? [...remote, "home"] : remote;
  };

  /** Spread `threads` of `script` across the fleet. Returns how many started. */
  const place = (script: string, threads: number, delayMs: number): number => {
    let left = Math.ceil(threads);
    for (const host of hosts()) {
      if (left <= 0) break;
      const fit = Math.floor(freeRam(host) / COST[script]);
      if (fit < 1) continue;
      const n = Math.min(fit, left);
      if (host !== "home") ns.scp(script, host, "home");
      // Unique last arg: without it the game rejects a second copy of the same
      // script with the same args on one host, and batches overlap by design.
      // A host that refuses is skipped, not fatal — one full disk or a race with
      // another controller must not abort placement across the whole fleet.
      if (ns.exec(script, host, n, target, delayMs, `${Date.now()}-${Math.random()}`) === 0) continue;
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
        place(W, Math.ceil(overSec / perWeaken), 0);
      } else {
        const grows = Math.ceil(ns.formulas.hacking.growThreads(s, player, s.moneyMax ?? 0));
        place(G, grows, 0);
        place(W, Math.ceil(ns.growthAnalyzeSecurity(grows, target) / perWeaken), 0);
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

    const room = Math.min(fleetFree(), BUDGET - held());

    if (p.ram > room) {
      starved++;
      if (starved % 25 === 1) ns.print(`no room: need ${p.ram.toFixed(0)}GB, have ${room.toFixed(0)}GB`);
    } else {
      for (const op of p.ops) place(op.script, op.threads, op.delay);
      inFlight.push({ until: Date.now() + p.window, ram: p.ram });
      batches++;
      if (batches % 20 === 0) {
        ns.print(`${batches} batches | ${(p.stolen * 100).toFixed(1)}%/batch | ${p.ram.toFixed(0)}GB each | ${held().toFixed(0)}GB held`);
      }
    }

    await ns.sleep(SPACING);
  }
}
