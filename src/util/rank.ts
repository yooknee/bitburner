import { NS } from "@ns";
import { fleet, prepped, score } from "lib/target";
import * as fmt from "lib/fmt";

/** What's actually worth hacking, by money per second per thread. */
export async function main(ns: NS): Promise<void> {
  const player = ns.getPlayer();
  const f = ns.formulas.hacking;

  // flatMap instead of filter: it narrows `p` from `Prepped | null` to `Prepped`,
  // which filter can't do — TypeScript doesn't track what a predicate proved.
  const rows = fleet(ns)
    .map((host) => ({ host, value: score(ns, host), p: prepped(ns, host) }))
    .flatMap((r) => (r.value > 0 && r.p ? [{ host: r.host, value: r.value, p: r.p }] : []))
    .sort((a, b) => b.value - a.value);

  ns.tprint("  server                $/sec/thread   chance   weaken      max $");
  for (const r of rows.slice(0, 15)) {
    const p = r.p;
    ns.tprint("  " + r.host.padEnd(22) +
      r.value.toFixed(0).padStart(12) +
      `${(f.hackChance(p.server, player) * 100).toFixed(0)}%`.padStart(9) +
      `${(f.weakenTime(p.server, player) / 1000).toFixed(0)}s`.padStart(9) +
      fmt.num(p.moneyMax).padStart(11));
  }
}
