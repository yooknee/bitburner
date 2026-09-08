import { NS } from "@ns";
import { fleet } from "lib/target";

/** Backdooring these triggers a faction invite. Worth confirming in-game. */
const FACTION = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "fulcrumassets"];

/**
 * List what you can backdoor right now, as paste-ready terminal chains.
 *
 * Scripted backdooring needs ns.singularity, which needs Source-File 4. Until
 * then this is the fast path: it does the route-finding and the eligibility
 * filtering, you do the pasting.
 */
export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");
  const level = ns.getHackingLevel();

  // The terminal's connect moves one hop at a time, so we need whole routes.
  const parent = new Map<string, string | null>([["home", null]]);
  const queue = ["home"];
  while (queue.length > 0) {
    const host = queue.shift() as string;
    for (const next of ns.scan(host)) {
      if (parent.has(next)) continue;
      parent.set(next, host);
      queue.push(next);
    }
  }
  parent.delete("home");

  const routeTo = (host: string): string[] => {
    const hops: string[] = [];
    for (let cur: string | null = host; cur !== null && cur !== "home"; cur = parent.get(cur) ?? null) hops.unshift(cur);
    return hops;
  };

  const todo = [];
  for (const host of parent.keys()) {
    // One getServer gives root status, backdoor status and required level at
    // once — 2GB, but cheaper than three getters and it runs on home.
    const s = ns.getServer(host);
    if (s.purchasedByPlayer) continue;
    if (!s.hasAdminRights) continue;
    if (s.backdoorInstalled === true) continue;
    if ((s.requiredHackingSkill ?? 0) > level) continue;

    todo.push({ host, faction: FACTION.includes(host), route: routeTo(host) });
  }

  // faction servers first, then shortest walk
  todo.sort((a, b) => Number(b.faction) - Number(a.faction) || a.route.length - b.route.length);

  if (todo.length === 0) { ns.tprint("nothing to backdoor right now."); return; }

  const lines = todo.map(({ host, faction, route }) =>
    (faction ? "* " : "  ") + host.padEnd(20) +
    "home; " + route.map((h) => `connect ${h}`).join("; ") + "; backdoor");

  ns.write("backdoor.txt", [
    `# ${todo.length} ready to backdoor - hacking level ${level}`,
    "# * = triggers a faction invite",
    "",
    ...lines,
  ].join("\n"), "w");

  ns.tprint(`${todo.length} ready -> backdoor.txt`);
  for (const line of lines.slice(0, 5)) ns.tprint(line);
}
