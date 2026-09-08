import { NS } from "@ns";
import { fleet, score } from "lib/target";
import { HOME_RESERVE, planBatch, saturationRam, workerCosts } from "lib/hwgw";

/**
 * Point the fleet at as many targets as it can usefully feed.
 *
 * usage: run hwgw/all.js [stealFraction]
 *
 * Targets are taken best-first and each gets a budget capped at what it can
 * actually absorb (see saturationRam). Once the fleet is spent we stop, so the
 * best target is always fully fed before a worse one gets anything.
 */
export async function main(ns: NS): Promise<void> {
  const steal = (ns.args[0] as number) ?? 0.1;

  const cost = workerCosts(ns);
  if (Object.values(cost).some((c) => c === 0)) { ns.tprint("ERROR: workers missing from home."); return; }

  const controllerRam = ns.getScriptRam("hwgw/batch.js", "home");
  const hosts = fleet(ns);

  const free = (h: string) =>
    ns.getServerMaxRam(h) - ns.getServerUsedRam(h) - (h === "home" ? HOME_RESERVE : 0);

  let left = hosts.reduce((sum, h) => sum + Math.max(0, free(h)), 0);

  const ranked = hosts
    .map((host) => ({ host, value: score(ns, host) }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  ns.tprint(`\nfleet: ${left.toFixed(0)}GB free, ${ranked.length} viable targets`);
  ns.tprint("  target                  budget   can absorb");

  const started: string[] = [];

  for (const { host } of ranked) {
    const batch = planBatch(ns, host, steal, cost);
    if (!batch) continue;

    // Each controller runs on home and costs RAM of its own, which comes out of
    // the same pool the workers draw from.
    if (free("home") < controllerRam) break;

    const absorbs = saturationRam(batch);
    const budget = Math.min(absorbs, left - controllerRam);

    // Below one batch there's nothing left to schedule.
    if (budget < batch.ram) break;

    if (ns.exec("hwgw/batch.js", "home", 1, host, steal, Math.floor(budget)) === 0) break;

    started.push(host);
    left -= budget + controllerRam;
    ns.tprint("  " + host.padEnd(22) + `${budget.toFixed(0)}GB`.padStart(9) + `${absorbs.toFixed(0)}GB`.padStart(13));

    await ns.sleep(100);   // stagger so they don't all prep in the same tick
  }

  ns.tprint(`\n${started.length} controller(s) running, ${Math.max(0, left).toFixed(0)}GB spare`);
  if (started.length <= 1) {
    ns.tprint("one target soaks up everything you have - buy RAM before adding targets.");
  }
}
