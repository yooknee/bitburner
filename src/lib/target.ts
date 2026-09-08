import { NS } from "@ns";
import { Server } from "@ns";

/** A server as the batcher wants to think about it: at max money, min security. */
export interface Prepped {
  server: Server;
  moneyMax: number;
  minDifficulty: number;
}

/**
 * Take a live server and return a copy in the state a batcher maintains.
 *
 * Every duration and yield the Formulas API reports depends on current
 * security and money, so planning against the live values would give numbers
 * that are wrong the moment the server moves. Plan against the invariant
 * instead: the state every completed batch restores.
 */
export function prepped(ns: NS, host: string): Prepped | null {
  const server = ns.getServer(host);
  const moneyMax = server.moneyMax ?? 0;
  const minDifficulty = server.minDifficulty ?? 0;
  if (moneyMax <= 0) return null;

  server.hackDifficulty = minDifficulty;
  server.moneyAvailable = moneyMax;
  return { server, moneyMax, minDifficulty };
}

/** Every server reachable from home that we have root on. */
export function fleet(ns: NS): string[] {
  const seen = new Set<string>(["home"]);
  const queue = ["home"];

  while (queue.length > 0) {
    const host = queue.pop() as string;
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }

  return [...seen].filter((h) => ns.hasRootAccess(h));
}

/**
 * Money per second per thread, if the target were held at its ideal state.
 * Weaken is the slowest operation in a cycle, so it sets the pace.
 */
export function score(ns: NS, host: string): number {
  const p = prepped(ns, host);
  if (!p) return 0;

  const player = ns.getPlayer();
  if ((p.server.requiredHackingSkill ?? 0) > player.skills.hacking) return 0;

  const f = ns.formulas.hacking;
  const perThread = f.hackPercent(p.server, player);
  const weakenSec = f.weakenTime(p.server, player) / 1000;

  return (p.moneyMax * perThread * f.hackChance(p.server, player)) / weakenSec;
}
