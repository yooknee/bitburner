import { NS } from "@ns";

/**
 * The simplest loop that makes money: keep one target weakened, grown, and
 * drained, forever. Deliberately dependency-free so `deploy.ts` can scp just
 * this one file onto a 4GB server without dragging a library along.
 *
 * Usage: run early/grind.js -t <threads> <target>
 */
export async function main(ns: NS): Promise<void> {
  const target = (ns.args[0] as string) ?? ns.getHostname();

  const moneyFloor = ns.getServerMaxMoney(target) * 0.75;
  const securityCeiling = ns.getServerMinSecurityLevel(target) + 5;

  ns.disableLog("ALL");

  for (;;) {
    if (ns.getServerSecurityLevel(target) > securityCeiling) {
      await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < moneyFloor) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}
