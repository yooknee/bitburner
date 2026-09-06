import { NS } from "@ns";

/** Every server reachable from `home`, excluding home itself. */
export function walk(ns: NS): string[] {
  const seen = new Set<string>(["home"]);
  const queue = ["home"];

  while (queue.length > 0) {
    const host = queue.pop() as string;
    for (const neighbour of ns.scan(host)) {
      if (!seen.has(neighbour)) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }

  seen.delete("home");
  return [...seen];
}

/** The port-opening programs we own, in the order the game hands them out. */
function openers(ns: NS): ((host: string) => void)[] {
  const all: [string, (host: string) => void][] = [
    ["BruteSSH.exe", (h) => ns.brutessh(h)],
    ["FTPCrack.exe", (h) => ns.ftpcrack(h)],
    ["relaySMTP.exe", (h) => ns.relaysmtp(h)],
    ["HTTPWorm.exe", (h) => ns.httpworm(h)],
    ["SQLInject.exe", (h) => ns.sqlinject(h)],
  ];
  return all.filter(([program]) => ns.fileExists(program, "home")).map(([, run]) => run);
}

/**
 * Root `host` if we can. Returns true if we have root afterwards, whether we
 * just cracked it or already had it.
 */
export function tryRoot(ns: NS, host: string): boolean {
  if (ns.hasRootAccess(host)) return true;

  const tools = openers(ns);
  if (tools.length < ns.getServerNumPortsRequired(host)) return false;

  for (const open of tools) open(host);
  ns.nuke(host);
  return ns.hasRootAccess(host);
}

/**
 * Rank rooted servers by how much money they're worth hacking right now.
 * The classic early-game rule of thumb: you want targets at or below half your
 * hacking level, because hack chance and speed fall off a cliff above that.
 */
export function rankTargets(ns: NS, hosts: string[]): string[] {
  const level = ns.getHackingLevel();

  return hosts
    .filter(
      (h) =>
        ns.hasRootAccess(h) &&
        ns.getServerMaxMoney(h) > 0 &&
        ns.getServerRequiredHackingLevel(h) <= Math.max(1, level / 2),
    )
    .sort(
      (a, b) =>
        ns.getServerMaxMoney(b) / ns.getServerMinSecurityLevel(b) -
        ns.getServerMaxMoney(a) / ns.getServerMinSecurityLevel(a),
    );
}

/** Free RAM on a host, in GB. */
export function freeRam(ns: NS, host: string): number {
  return ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
}
