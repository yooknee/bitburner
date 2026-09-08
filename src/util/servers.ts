import { NS } from "@ns";
import * as fmt from "lib/fmt";

const PREFIX = "cloud-";

/**
 * Buy and upgrade cloud servers, greedily, at the best tier you can afford.
 *
 * usage: run util/servers.js [spendFraction] [loop]
 *   spendFraction  how much of your cash it may commit per action (default 0.75)
 *   loop           keep ratcheting up as the batcher earns, instead of one pass
 *
 * Why not just buy the game maximum: RAM must be a power of two up to 2^20 (1PB),
 * and the cost curve at the top is vicious. Twenty-five mid-tier servers give far
 * more total RAM per dollar than one maxed one, so this fills every slot at the
 * best affordable tier first and only then starts raising the floor.
 *
 * It never deletes and rebuys. Upgrading in place keeps the hostname and every
 * script running on it — deleting would drop live batches on the floor.
 */
export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");

  const spend = (ns.args[0] as number) ?? 0.75;
  const loop = ns.args.includes("loop");

  const limit = ns.cloud.getServerLimit();
  const maxRam = ns.cloud.getRamLimit();

  // Every legal size, biggest first, so `find` returns the best affordable one.
  const tiers: number[] = [];
  for (let r = 2; r <= maxRam; r *= 2) tiers.push(r);
  tiers.reverse();

  const nextName = (owned: string[]): string | null => {
    for (let i = 0; i < limit; i++) {
      if (!owned.includes(`${PREFIX}${i}`)) return `${PREFIX}${i}`;
    }
    return null;
  };

  /** One purchase or one upgrade. Returns what it did, or null if it can't act. */
  const step = (): string | null => {
    const budget = ns.getServerMoneyAvailable("home") * spend;
    const owned = ns.cloud.getServerNames();

    // A new server adds capacity outright, so filling a slot beats upgrading.
    if (owned.length < limit) {
      const ram = tiers.find((r) => ns.cloud.getServerCost(r) <= budget) ?? 0;
      const name = nextName(owned);
      if (ram > 0 && name) {
        const host = ns.cloud.purchaseServer(name, ram);
        if (host) return `bought ${host} @ ${fmt.ram(ram)}`;
      }
      // Can't afford even the smallest tier — an upgrade won't be cheaper.
      if (ram === 0) return null;
    }

    // All slots full: raise the weakest link, since the batcher places threads
    // per host and the smallest server is what caps a single operation.
    const weakest = owned
      .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
      .sort((a, b) => a.ram - b.ram)[0];
    if (!weakest) return null;

    const ram = tiers.find((r) => r > weakest.ram && ns.cloud.getServerUpgradeCost(weakest.host, r) <= budget) ?? 0;
    if (ram > 0 && ns.cloud.upgradeServer(weakest.host, ram)) {
      return `upgraded ${weakest.host} ${fmt.ram(weakest.ram)} -> ${fmt.ram(ram)}`;
    }

    return null;
  };

  const total = () => ns.cloud.getServerNames().reduce((sum, h) => sum + ns.getServerMaxRam(h), 0);
  const before = total();

  for (;;) {
    const did = step();
    if (did) ns.tprint(did);
    else if (!loop) break;

    await ns.sleep(loop ? 10000 : 200);
  }

  const owned = ns.cloud.getServerNames();
  ns.tprint(`${owned.length}/${limit} servers, ${fmt.ram(total())} total (was ${fmt.ram(before)})`);
}
