import { NS } from "@ns";
import { fleet } from "lib/target";

/**
 * Stop everything, everywhere.
 *
 * usage: run util/killall.js
 *
 * The terminal's `killall` only clears the server you're standing on, which is
 * useless when workers are spread across thirty hosts. Switching strategies
 * without this leaves old workers hacking your target forever — they'll drift
 * its security and money and the batcher will read that as permanent desync.
 */
export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");

  const self = ns.getScriptName();
  let killed = 0;

  for (const host of fleet(ns)) {
    if (host === "home") continue;   // home last, so we don't cut our own legs off
    const running = ns.ps(host).length;
    if (running > 0 && ns.killall(host)) killed += running;
  }

  // On home, kill by pid so we can skip ourselves — killall would take us too,
  // leaving whatever came after it alive.
  for (const proc of ns.ps("home")) {
    if (proc.filename === self) continue;
    if (ns.kill(proc.pid)) killed++;
  }

  ns.tprint(`killed ${killed} process(es) across the fleet`);
}
