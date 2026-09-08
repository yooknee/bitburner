import { NS } from "@ns";

const SCAN_DEPTH = 3;   // hops per pass, mirroring `scan-analyze 3`
const PASSES = 4;       // hop to the edge and scan again, this many times
                        // reach = SCAN_DEPTH * PASSES; for everything: 100 x 1

/**
 * Root everything reachable, then write rooted.txt with a paste-ready connect
 * chain per server. Safe to re-run: rooting is idempotent and the file is
 * overwritten, so run it again after every new .exe or level jump.
 */
export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");

  // depth is absolute hops from home; parent is whoever found us, which is what
  // lets us rebuild a route later.
  const seen = new Map<string, { depth: number; parent: string | null }>([["home", { depth: 0, parent: null }]]);
  let frontier = ["home"];

  for (let pass = 1; pass <= PASSES && frontier.length > 0; pass++) {
    const queue = frontier.map((host) => ({ host, hops: 0 }));
    const nextFrontier: string[] = [];
    let found = 0;

    while (queue.length > 0) {
      const { host, hops } = queue.shift() as { host: string; hops: number };

      if (hops >= SCAN_DEPTH) { nextFrontier.push(host); continue; }

      for (const next of ns.scan(host)) {
        if (seen.has(next)) continue;
        seen.set(next, { depth: (seen.get(host) as { depth: number }).depth + 1, parent: host });
        queue.push({ host: next, hops: hops + 1 });
        found++;
      }
    }

    ns.tprint(`pass ${pass}: +${found} new (${seen.size - 1} total)`);
    frontier = nextFrontier;
  }
  seen.delete("home");

  // Only the openers we own. Arrow-wrapped so `ns` stays attached.
  const openers: [string, (host: string) => void][] = [
    ["BruteSSH.exe", (h) => ns.brutessh(h)],
    ["FTPCrack.exe", (h) => ns.ftpcrack(h)],
    ["relaySMTP.exe", (h) => ns.relaysmtp(h)],
    ["HTTPWorm.exe", (h) => ns.httpworm(h)],
    ["SQLInject.exe", (h) => ns.sqlinject(h)],
  ];
  const owned = openers.filter(([program]) => ns.fileExists(program, "home"));

  const rooted: string[] = [];
  const blocked: string[] = [];

  for (const host of seen.keys()) {
    if (ns.hasRootAccess(host)) { rooted.push(host); continue; }
    if (owned.length < ns.getServerNumPortsRequired(host)) { blocked.push(host); continue; }

    for (const [, open] of owned) open(host);   // re-opening a port is harmless
    ns.nuke(host);
    (ns.hasRootAccess(host) ? rooted : blocked).push(host);
  }

  rooted.sort();

  // Walk parent links back toward home. unshift builds home-first order without
  // a final reverse().
  const routeTo = (host: string): string[] => {
    const hops: string[] = [];
    for (let cur: string | null = host; cur !== null && cur !== "home"; cur = seen.get(cur)?.parent ?? null) {
      hops.unshift(cur);
    }
    return hops;
  };

  const deepest = Math.max(0, ...[...seen.values()].map((v) => v.depth));

  ns.write("rooted.txt", [
    `# rooted servers - ${new Date().toISOString()}`,
    `# ${seen.size} servers found, deepest ${deepest} hops (${SCAN_DEPTH} x ${PASSES} passes)`,
    `# ${owned.length}/5 port openers owned`,
    `# ${rooted.length} rooted, ${blocked.length} locked: ${blocked.sort().join(", ") || "none"}`,
    "# hostname, then a connect chain you can paste into the terminal",
    "",
    ...rooted.map((host) => host.padEnd(22) + "connect " + routeTo(host).join("; connect ")),
  ].join("\n"), "w");

  ns.tprint(`rooted ${rooted.length}, blocked ${blocked.length} -> rooted.txt`);
}
