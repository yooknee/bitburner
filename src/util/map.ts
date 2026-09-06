import { NS } from "@ns";
import { walk, freeRam } from "lib/net";
import * as fmt from "lib/fmt";

/**
 * Print every server on the network with the facts you actually care about:
 * whether you have root, what it takes to get it, and what it's worth.
 *
 * Usage: run util/map.js
 */
export async function main(ns: NS): Promise<void> {
  const level = ns.getHackingLevel();

  const rows = walk(ns)
    .map((host) => ({
      host,
      root: ns.hasRootAccess(host),
      ports: ns.getServerNumPortsRequired(host),
      req: ns.getServerRequiredHackingLevel(host),
      money: ns.getServerMaxMoney(host),
      ram: ns.getServerMaxRam(host),
      free: freeRam(ns, host),
    }))
    .sort((a, b) => b.money - a.money);

  ns.tprint(`\nhacking level ${level}\n`);
  ns.tprint("  root  host                    req  ports        max $      RAM   free");

  for (const r of rows) {
    const flag = r.root ? " [x] " : r.req <= level ? " [ ] " : "  .  ";
    ns.tprint(
      flag +
        r.host.padEnd(22) +
        String(r.req).padStart(5) +
        String(r.ports).padStart(6) +
        fmt.num(r.money).padStart(13) +
        fmt.ram(r.ram).padStart(9) +
        fmt.ram(r.free).padStart(7),
    );
  }
}
